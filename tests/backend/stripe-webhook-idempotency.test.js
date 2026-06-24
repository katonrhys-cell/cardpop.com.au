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

vi.mock('stripe', () => ({ default: vi.fn(function () { return mockStripe; }) }));

// Don't send real emails on the happy paths.
vi.mock('../../src/utils/emailService.js', () => ({
  sendOrderConfirmed: vi.fn().mockResolvedValue(undefined),
  sendItemSold: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessed: vi.fn().mockResolvedValue(undefined),
  sendRefundIssued: vi.fn().mockResolvedValue(undefined),
}));

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
