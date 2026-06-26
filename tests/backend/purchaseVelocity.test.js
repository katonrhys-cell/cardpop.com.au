import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { checkPurchaseVelocity, VELOCITY_LIMITS } from '../../src/utils/purchaseVelocity.js';

// A query builder whose terminal `.maybeSingle()` or thenable resolves to result.
function profileBuilder(profile) {
  const b = {
    select: vi.fn(() => b), eq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve({ data: profile, error: null })),
  };
  return b;
}
function ordersBuilder(orders) {
  const b = {
    select: vi.fn(() => b), eq: vi.fn(() => b), gte: vi.fn(() => b),
    then: (resolve, reject) => Promise.resolve({ data: orders, error: null }).then(resolve, reject),
  };
  return b;
}

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => vi.clearAllMocks());

describe('checkPurchaseVelocity', () => {
  it('allows verified accounts regardless of size/frequency', async () => {
    mockSupabase.from.mockReturnValueOnce(profileBuilder({ created_at: daysAgo(0), is_verified: true }));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 99999 });
    expect(r.allowed).toBe(true);
    // never needs to look at orders
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('allows accounts older than the new-account window', async () => {
    mockSupabase.from.mockReturnValueOnce(profileBuilder({ created_at: daysAgo(30), is_verified: false }));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 99999 });
    expect(r.allowed).toBe(true);
  });

  it('blocks a new account from an over-cap single order', async () => {
    mockSupabase.from.mockReturnValueOnce(profileBuilder({ created_at: daysAgo(1), is_verified: false }));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: VELOCITY_LIMITS.perOrderAud + 1 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('per_order');
  });

  it('blocks a new account that exceeds the daily order count', async () => {
    const orders = Array.from({ length: VELOCITY_LIMITS.ordersPer24h }, () => ({ total_aud: 10, status: 'payment_confirmed' }));
    mockSupabase.from
      .mockReturnValueOnce(profileBuilder({ created_at: daysAgo(1), is_verified: false }))
      .mockReturnValueOnce(ordersBuilder(orders));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 10 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('order_count');
  });

  it('blocks a new account that exceeds the daily spend', async () => {
    const orders = [{ total_aud: VELOCITY_LIMITS.spendPer24hAud - 100, status: 'payment_confirmed' }];
    mockSupabase.from
      .mockReturnValueOnce(profileBuilder({ created_at: daysAgo(1), is_verified: false }))
      .mockReturnValueOnce(ordersBuilder(orders));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 200 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('daily_spend');
  });

  it('does not count failed/cancelled/refunded orders toward velocity', async () => {
    const orders = [
      { total_aud: 5000, status: 'payment_failed' },
      { total_aud: 5000, status: 'refunded' },
      { total_aud: 100, status: 'payment_confirmed' },
    ];
    mockSupabase.from
      .mockReturnValueOnce(profileBuilder({ created_at: daysAgo(1), is_verified: false }))
      .mockReturnValueOnce(ordersBuilder(orders));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 100 });
    expect(r.allowed).toBe(true);
  });

  it('allows a normal new-account order within all limits', async () => {
    mockSupabase.from
      .mockReturnValueOnce(profileBuilder({ created_at: daysAgo(1), is_verified: false }))
      .mockReturnValueOnce(ordersBuilder([{ total_aud: 50, status: 'payment_confirmed' }]));
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 120 });
    expect(r.allowed).toBe(true);
  });

  it('fails open if the lookup throws (never blocks all checkouts)', async () => {
    mockSupabase.from.mockImplementation(() => { throw new Error('db down'); });
    const r = await checkPurchaseVelocity({ userId: 'u1', orderValueAud: 100 });
    expect(r.allowed).toBe(true);
  });
});
