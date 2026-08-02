import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── supabase double ──────────────────────────────────────────────────────────
// Records every insert and serves per-table canned reads, so a test can assert
// what the service would actually write.

const state = vi.hoisted(() => ({
  pendingOrders: [],
  pendingError: null,
  priorAlerts: [],
  admins: [{ id: 'admin-1' }],
  inserted: [],
  lastOrdersFilters: {},
}));

vi.mock('../../src/utils/supabaseClient.js', () => {
  const ordersQuery = () => {
    const q = {
      select: () => q,
      eq: (col, val) => { state.lastOrdersFilters[col] = val; return q; },
      not: () => q,
      lt: (col, val) => { state.lastOrdersFilters[col] = val; return q; },
      order: () => q,
      in: () => q,
      limit: () => Promise.resolve({ data: state.pendingOrders, error: state.pendingError }),
      then: (resolve) => resolve({ data: state.pendingOrders, error: state.pendingError }),
    };
    return q;
  };

  const simpleQuery = (rows) => {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => Promise.resolve({ data: rows(), error: null }),
      then: (resolve) => resolve({ data: rows(), error: null }),
    };
    return q;
  };

  const sb = {
    from: (table) => {
      if (table === 'orders') return ordersQuery();
      if (table === 'notifications') {
        return {
          ...simpleQuery(() => state.priorAlerts),
          insert: (rows) => { state.inserted.push(...rows); return Promise.resolve({ error: null }); },
        };
      }
      if (table === 'profiles') return simpleQuery(() => state.admins);
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { supabase: sb, default: sb };
});

import { findUnfulfilledPaidOrders, alertStuckOrders } from '../../src/services/pendingOrderAlertService.js';

const mockStripe = { checkout: { sessions: { retrieve: vi.fn() } } };

const NOW = Date.parse('2026-07-31T12:00:00Z');
const longAgo = new Date(NOW - 60 * 60 * 1000).toISOString(); // an hour old

beforeEach(() => {
  mockStripe.checkout.sessions.retrieve.mockReset();
  state.pendingOrders = [];
  state.pendingError = null;
  state.priorAlerts = [];
  state.admins = [{ id: 'admin-1' }];
  state.inserted = [];
  state.lastOrdersFilters = {};
});

describe('findUnfulfilledPaidOrders', () => {
  it('flags a pending order whose Stripe session is paid', async () => {
    state.pendingOrders = [{ id: 'ord-1', stripe_session_id: 'cs_1', total_aud: '5.67', created_at: longAgo }];
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      payment_status: 'paid',
      payment_intent: 'pi_123',
    });

    const result = await findUnfulfilledPaidOrders(mockStripe, { now: NOW });

    expect(result.checked).toBe(1);
    expect(result.stuck).toEqual([{
      orderId: 'ord-1',
      sessionId: 'cs_1',
      totalAud: 5.67,
      createdAt: longAgo,
      paymentIntentId: 'pi_123',
    }]);
  });

  it('ignores an unpaid session — an ordinary abandoned checkout', async () => {
    state.pendingOrders = [{ id: 'ord-2', stripe_session_id: 'cs_2', total_aud: '5', created_at: longAgo }];
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({ payment_status: 'unpaid' });

    const result = await findUnfulfilledPaidOrders(mockStripe, { now: NOW });

    expect(result.stuck).toEqual([]);
  });

  it('only looks at orders past the grace period', async () => {
    await findUnfulfilledPaidOrders(mockStripe, { now: NOW });
    // 15-minute cutoff, so nothing newer than 11:45 is considered.
    expect(state.lastOrdersFilters.created_at).toBe('2026-07-31T11:45:00.000Z');
    expect(state.lastOrdersFilters.status).toBe('pending');
  });

  it('keeps scanning when one session cannot be retrieved', async () => {
    state.pendingOrders = [
      { id: 'ord-bad', stripe_session_id: 'cs_gone', total_aud: '1', created_at: longAgo },
      { id: 'ord-good', stripe_session_id: 'cs_ok', total_aud: '2', created_at: longAgo },
    ];
    mockStripe.checkout.sessions.retrieve
      .mockRejectedValueOnce(new Error('No such checkout session'))
      .mockResolvedValueOnce({ payment_status: 'paid' });

    const result = await findUnfulfilledPaidOrders(mockStripe, { now: NOW });

    expect(result.checked).toBe(2);
    expect(result.stuck.map(s => s.orderId)).toEqual(['ord-good']);
  });

  it('makes no Stripe calls when nothing is pending', async () => {
    const result = await findUnfulfilledPaidOrders(mockStripe, { now: NOW });

    expect(result).toEqual({ checked: 0, stuck: [], truncated: false });
    expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
});

describe('alertStuckOrders', () => {
  const stuck = [{ orderId: 'ord-1', sessionId: 'cs_1', totalAud: 5.67, createdAt: longAgo, paymentIntentId: 'pi_1' }];

  it('notifies every admin, tagging the order so it can be deduped', async () => {
    state.admins = [{ id: 'admin-1' }, { id: 'admin-2' }];

    const result = await alertStuckOrders(stuck);

    expect(result.alerted).toBe(1);
    expect(state.inserted).toHaveLength(2);
    expect(state.inserted[0]).toMatchObject({
      user_id: 'admin-1',
      type: 'order_payment_unfulfilled',
      related_id: 'ord-1',
    });
    // The body has to carry the session id — it's what you resend in Stripe.
    expect(state.inserted[0].body).toContain('cs_1');
  });

  it('stays quiet on an order already reported (hourly cron must not spam)', async () => {
    state.priorAlerts = [{ related_id: 'ord-1' }];

    const result = await alertStuckOrders(stuck);

    expect(result).toMatchObject({ alerted: 0, suppressed: 1 });
    expect(state.inserted).toHaveLength(0);
  });

  it('still reports when there are no admins to notify', async () => {
    state.admins = [];

    const result = await alertStuckOrders(stuck);

    expect(result.alerted).toBe(1);
    expect(result.notified).toBe(0);
  });

  it('does nothing at all when nothing is stuck', async () => {
    expect(await alertStuckOrders([])).toEqual({ alerted: 0, suppressed: 0 });
    expect(state.inserted).toHaveLength(0);
  });
});
