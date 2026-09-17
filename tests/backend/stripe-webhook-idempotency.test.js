import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Regression tests for the Stripe webhook idempotency guards added to prevent
// duplicate orders / double seller payouts when Stripe delivers
// checkout.session.completed more than once (at-least-once / concurrent retries).
//
// A flexible Supabase mock records every from()/rpc() call and returns results
// from a per-test `respond(ctx)` function so we can simulate a unique-violation
// on insert (single-item path) and a 0-row compare-and-swap (cart path).

const mockStripe = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
  transfers: { create: vi.fn() },
  refunds: { create: vi.fn() },
}));

// stripeClient lazy-requires the SDK via createRequire (see src/utils/stripeClient.js),
// which bypasses ESM module mocks — so mock the client module itself.
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

// Don't send real emails on the happy paths. Hoisted so tests can assert which
// notices went out — and make one fail on purpose.
const mockEmail = vi.hoisted(() => ({
  sendOrderConfirmed: vi.fn().mockResolvedValue(undefined),
  sendItemSold: vi.fn().mockResolvedValue(undefined),
  sendOrderAdminNotice: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessed: vi.fn().mockResolvedValue(undefined),
  sendRefundIssued: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/utils/emailService.js', () => mockEmail);

// ─── Programmable Supabase mock ───────────────────────────────────────────────

const dbCalls = vi.hoisted(() => []);
const rpcCalls = vi.hoisted(() => []);
// Default: every call resolves to empty. Tests overwrite `respond`.
const state = vi.hoisted(() => ({ respond: () => ({ data: null, error: null }) }));

vi.mock('../../src/utils/supabaseClient.js', () => {
  function makeBuilder(table) {
    const ctx = { table, op: 'select', single: false, cols: null, filters: {}, payload: null };
    const exec = () => {
      dbCalls.push({ table: ctx.table, op: ctx.op, single: ctx.single, cols: ctx.cols, filters: ctx.filters, payload: ctx.payload });
      return Promise.resolve(state.respond(ctx));
    };
    const builder = {
      select(cols) { ctx.cols = cols; return builder; },
      insert(payload) { ctx.op = 'insert'; ctx.payload = payload; return builder; },
      update(payload) { ctx.op = 'update'; ctx.payload = payload; return builder; },
      upsert(payload) { ctx.op = 'upsert'; ctx.payload = payload; return builder; },
      delete() { ctx.op = 'delete'; return builder; },
      eq(k, v) { ctx.filters[k] = v; return builder; },
      neq() { return builder; },
      contains() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      range() { return builder; },
      maybeSingle() { ctx.single = true; return exec(); },
      single() { ctx.single = true; return exec(); },
      then(onF, onR) { return exec().then(onF, onR); },
    };
    return builder;
  }
  const sb = {
    from: (t) => makeBuilder(t),
    rpc: (name, args) => { rpcCalls.push({ name, args }); return Promise.resolve(state.respond({ table: 'rpc', op: 'rpc', name, args })); },
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  };
  return { supabase: sb, default: sb };
});

import stripeRouter from '../../src/routes/stripe.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', stripeRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function postWebhook() {
  return request(app)
    .post('/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 'valid-sig')
    .send(Buffer.from('{}'));
}

beforeEach(() => {
  vi.clearAllMocks();
  dbCalls.length = 0;
  rpcCalls.length = 0;
  state.respond = () => ({ data: null, error: null });
});

// ─── Single-item path: duplicate delivery (unique violation) ──────────────────

describe('webhook single-item idempotency', () => {
  const singleSession = {
    id: 'cs_single',
    amount_total: 10000, // $100.00 — matches itemPrice metadata below
    payment_intent: 'pi_single',
    metadata: {
      userId: 'buyer-1', listingId: 'l1', sellerId: 'seller-1',
      itemPrice: '100', commissionPct: '0', commissionAud: '0', gstAud: '0',
      sellerProceedsAud: '100', configId: '',
    },
  };

  beforeEach(() => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: singleSession },
    });
  });

  it('treats a duplicate order insert (23505) as an idempotent skip — no payout', async () => {
    state.respond = (ctx) => {
      // No pre-existing order for this session → take the insert path.
      if (ctx.table === 'orders' && ctx.single) return { data: null, error: null };
      // A concurrent delivery already inserted this order.
      if (ctx.table === 'orders' && ctx.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key' } };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    // The crucial regression: we must NOT pay the seller for a duplicate event.
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    // And we must not have progressed to marking the listing sold.
    expect(dbCalls.some(c => c.table === 'listings' && c.op === 'update')).toBe(false);
  });

  it('rejects a session whose Stripe amount does not match the metadata total', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: null, error: null };
      return { data: null, error: null };
    };
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { ...singleSession, amount_total: 5000 } }, // $50 ≠ $100 expected
    });

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    // Mismatch must short-circuit before any order is inserted or paid out.
    expect(dbCalls.some(c => c.table === 'orders' && c.op === 'insert')).toBe(false);
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    // The captured payment must be auto-refunded (money was already taken).
    expect(mockStripe.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_single' });
  });

  it('still notifies admins and pays the seller when the buyer receipt email fails', async () => {
    // Regression: sendOrderConfirmed / sendItemSold were awaited without a
    // catch, so a Resend outage threw out of the handler BEFORE the admin
    // notice and before payoutSeller — costing the seller their money over a
    // failed email.
    mockEmail.sendOrderConfirmed.mockRejectedValueOnce(new Error('resend down'));
    mockEmail.sendItemSold.mockRejectedValueOnce(new Error('resend down'));
    let ordersSelects = 0;
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) {
        // First select is the "already handled?" pre-check (must be empty so we
        // take the insert path); the later one resolves the new order's id.
        ordersSelects += 1;
        return { data: ordersSelects === 1 ? null : { id: 'o-new' }, error: null };
      }
      if (ctx.table === 'orders' && ctx.op === 'insert') return { data: { id: 'o-new' }, error: null };
      // The listing is claimed successfully, so the handler runs the full
      // fulfilment path rather than the double-sale bail-out.
      if (ctx.table === 'listings' && ctx.op === 'update') return { data: [{ id: 'l1' }], error: null };
      if (ctx.table === 'profiles' && ctx.single) {
        return { data: { email: 'x@y.com', display_name: 'X', stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true }, error: null };
      }
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(mockEmail.sendOrderAdminNotice).toHaveBeenCalled();
    expect(mockStripe.transfers.create).toHaveBeenCalled();
  });

  it('counts the processing fee in the expected total, and keeps it out of the seller payout', async () => {
    // Regression guard: the fee is a real Stripe line, so leaving it out of the
    // expected-total check would make the amount guard reject — and auto-refund
    // — every single order that carries one.
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: null, error: null };
      if (ctx.table === 'orders' && ctx.op === 'insert') return { data: { id: 'o-new' }, error: null };
      if (ctx.table === 'profiles' && ctx.single) {
        return { data: { stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true }, error: null };
      }
      return { data: null, error: null };
    };
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          ...singleSession,
          amount_total: 10256, // $100 item + $2.56 processing
          metadata: { ...singleSession.metadata, processingFeeAud: '2.56' },
        },
      },
    });

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(mockStripe.refunds.create).not.toHaveBeenCalled();
    const insert = dbCalls.find(c => c.table === 'orders' && c.op === 'insert');
    expect(insert).toBeDefined();
    // Recorded as its own column, kept out of platform_fee_aud (commission +
    // GST) — and the seller's proceeds do not include a cent of it.
    expect(insert.payload.processing_fee_aud).toBe(2.56);
    expect(insert.payload.platform_fee_aud).toBe(0);
    expect(insert.payload.seller_proceeds_aud).toBe(100);
    expect(insert.payload.total_aud).toBe(102.56);
  });
});

// ─── payment_status gating: don't fulfil an unpaid/async-pending session ───────

describe('webhook payment_status gating', () => {
  it('defers fulfilment when checkout.session.completed arrives unpaid', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_async', payment_status: 'unpaid', amount_total: 11000, payment_intent: 'pi_a', metadata: {} } },
    });
    let ordersTouched = false;
    state.respond = (ctx) => {
      if (ctx.table === 'orders') ordersTouched = true;
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    // Deferred before any order work — no fulfilment for an uncaptured payment.
    expect(ordersTouched).toBe(false);
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });

  it('fulfils on checkout.session.async_payment_succeeded once paid', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: { object: { id: 'cs_cart', payment_status: 'paid', amount_total: 11000, payment_intent: 'pi_cart' } },
    });
    const pendingOrder = {
      id: 'order-async-1', status: 'pending', total_aud: 110,
      order_items: [{ type: 'shop', id: 'p1', quantity: 1, seller_id: null }], buyer_id: 'buyer-1',
    };
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: pendingOrder, error: null };
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [{ id: pendingOrder.id }], error: null };
      if (ctx.table === 'profiles' && ctx.single) return { data: { email: null, display_name: 'Buyer' }, error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    // The paid async event drives the normal cart fulfilment (stock decrement).
    expect(rpcCalls.filter(c => c.name === 'decrement_shop_stock')).toHaveLength(1);
  });
});

// ─── DB error on the confirm CAS must retry (500), not be treated as done ──────

describe('webhook confirm-CAS error handling', () => {
  it('returns 500 (so Stripe retries) when the confirm update errors', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_cart', amount_total: 11000, payment_intent: 'pi_cart' } },
    });
    const pendingOrder = {
      id: 'order-err-1', status: 'pending', total_aud: 110,
      order_items: [{ type: 'shop', id: 'p1', quantity: 1, seller_id: null }], buyer_id: 'buyer-1',
    };
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: pendingOrder, error: null };
      // Transient DB error on the pending→confirmed compare-and-swap.
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: null, error: { code: 'XX000', message: 'db hiccup' } };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(500);
    // Must NOT have recorded the event as processed (so the retry reprocesses).
    expect(dbCalls.some(c => c.table === 'stripe_webhook_events' && c.op === 'insert')).toBe(false);
    // Must NOT have paid the seller on the failed confirm.
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });
});

// ─── Cart path: pre-created pending order, compare-and-swap confirm ────────────

describe('webhook cart idempotency', () => {
  const cartSession = { id: 'cs_cart', amount_total: 11000, payment_intent: 'pi_cart' };
  const pendingOrder = {
    id: 'order-cart-1',
    status: 'pending',
    total_aud: 110, // $110.00 — matches amount_total
    order_items: [{ type: 'shop', id: 'p1', quantity: 1, seller_id: null }],
    buyer_id: 'buyer-1',
  };

  beforeEach(() => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: cartSession },
    });
  });

  it('skips processing when the compare-and-swap claims 0 rows (already confirmed)', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: pendingOrder, error: null };
      // Concurrent delivery already flipped pending → confirmed: 0 rows claimed.
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [], error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    // Must not decrement stock or notify twice.
    expect(rpcCalls.find(c => c.name === 'decrement_shop_stock')).toBeUndefined();
    expect(dbCalls.some(c => c.table === 'notifications' && c.op === 'insert')).toBe(false);
  });

  it('processes the order exactly once when the compare-and-swap claims the row', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: pendingOrder, error: null };
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [{ id: pendingOrder.id }], error: null };
      // Buyer profile lookup → no email so we don't exercise the mailer.
      if (ctx.table === 'profiles' && ctx.single) return { data: { email: null, display_name: 'Buyer' }, error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    // The single winning delivery decrements stock once for the shop line.
    const decrements = rpcCalls.filter(c => c.name === 'decrement_shop_stock');
    expect(decrements).toHaveLength(1);
    expect(decrements[0].args).toMatchObject({ p_id: 'p1', p_qty: 1 });
  });
});

// ─── checkout.session.expired: clean up stale pending orders ───────────────────

describe('webhook checkout.session.expired', () => {
  beforeEach(() => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_expired' } },
    });
  });

  it('cancels the pending order for the expired session (pending → cancelled, guarded)', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [{ id: 'order-x' }], error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    const upd = dbCalls.find(c => c.table === 'orders' && c.op === 'update');
    expect(upd).toBeDefined();
    expect(upd.payload).toMatchObject({ status: 'cancelled' });
    // Guarded so it can only ever touch a still-pending row for THIS session.
    expect(upd.filters).toMatchObject({ stripe_session_id: 'cs_expired', status: 'pending' });
  });
});

// ─── Event-level idempotency (stripe_webhook_events dedup) ──────────────────────

describe('webhook event-id dedup', () => {
  it('skips an event whose id was already recorded — no handler runs', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_whatever', amount_total: 10000, metadata: {} } },
    });
    state.respond = (ctx) => {
      // The dedup lookup finds a prior record for this event id.
      if (ctx.table === 'stripe_webhook_events' && ctx.single) return { data: { event_id: 'evt_dup' }, error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.deduped).toBe(true);
    // No order work happened — the switch was never entered.
    expect(dbCalls.some(c => c.table === 'orders')).toBe(false);
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });

  it('records the event id after a successful first delivery', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_new',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_new' } },
    });
    state.respond = () => ({ data: null, error: null });

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    const rec = dbCalls.find(c => c.table === 'stripe_webhook_events' && c.op === 'insert');
    expect(rec).toBeDefined();
    expect(rec.payload).toMatchObject({ event_id: 'evt_new', type: 'checkout.session.expired' });
  });
});
