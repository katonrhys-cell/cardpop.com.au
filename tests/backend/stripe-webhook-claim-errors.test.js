import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Listing-claim error handling and the single-item shipping address.
//
// claimListingSold used to return false on ANY DB error, and both callers read
// false as "someone else already bought it" — refunding the buyer and never
// paying the seller over a transient blip. A DB error now throws (webhook 500 →
// Stripe redelivers), and each path undoes its own progress first so the retry
// actually re-processes instead of skipping a half-done order.

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
      in() { return builder; },
      is() { return builder; },
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
  mockStripe.transfers.create.mockResolvedValue({ id: 'tr_new' });
});

const listingUpdates = () => dbCalls.filter(c => c.table === 'listings' && c.op === 'update');
const doubleSaleAlerts = () => dbCalls.filter(c => c.table === 'notifications' && c.op === 'insert'
  && [].concat(c.payload).some(n => n?.type === 'order_double_sale' || n?.type === 'order_refund_pending'));

// ─── claimListingSold: a DB error is not a lost race ──────────────────────────

describe('single-item listing claim errors', () => {
  const singleSession = {
    id: 'cs_single',
    amount_total: 10000,
    payment_intent: 'pi_single',
    metadata: {
      userId: 'buyer-1', listingId: 'l1', sellerId: 'seller-1',
      itemPrice: '100', commissionPct: '0', commissionAud: '0', gstAud: '0',
      sellerProceedsAud: '100', configId: '',
    },
  };

  it('500s (so Stripe retries), removes the order it just wrote, and never refunds or flags a double sale', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: singleSession } });
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: null, error: null };
      if (ctx.table === 'orders' && ctx.op === 'insert') return { data: null, error: null };
      if (ctx.table === 'listings' && ctx.op === 'update') return { data: null, error: { code: 'XX000', message: 'db hiccup' } };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(500);
    // The retry has to find no order, or it would skip the session as done.
    const del = dbCalls.find(c => c.table === 'orders' && c.op === 'delete');
    expect(del).toBeDefined();
    expect(del.filters).toMatchObject({ stripe_session_id: 'cs_single', status: 'payment_confirmed' });
    expect(doubleSaleAlerts()).toHaveLength(0);
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    expect(mockStripe.refunds.create).not.toHaveBeenCalled();
    expect(dbCalls.some(c => c.table === 'stripe_webhook_events' && c.op === 'insert')).toBe(false);
  });

  it('still treats "no error, zero rows" as a lost race (double sale), keeping the order', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: singleSession } });
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: null, error: null };
      if (ctx.table === 'listings' && ctx.op === 'update') return { data: [], error: null };
      if (ctx.table === 'profiles' && !ctx.single) return { data: [{ id: 'admin-1' }], error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(dbCalls.some(c => c.table === 'orders' && c.op === 'delete')).toBe(false);
    expect(doubleSaleAlerts().length).toBeGreaterThan(0);
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });
});

describe('cart listing claim errors', () => {
  const cartSession = { id: 'cs_cart', amount_total: 11000, payment_intent: 'pi_cart' };
  const makeOrder = (items) => ({
    id: 'order-cart-1', status: 'pending', total_aud: 110, buyer_id: 'buyer-1', order_items: items,
  });

  beforeEach(() => {
    mockStripe.webhooks.constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: cartSession } });
  });

  it('returns the order to pending with its won claims remembered, and 500s before any side effect', async () => {
    const order = makeOrder([
      { type: 'listing', id: 'l1', seller_id: 's1', line_total_aud: 50, commission_aud: 0 },
      { type: 'listing', id: 'l2', seller_id: 's2', line_total_aud: 50, commission_aud: 0 },
      { type: 'shop', id: 'p1', quantity: 1, seller_id: null },
    ]);
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: order, error: null };
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [{ id: order.id }], error: null };
      if (ctx.table === 'listings' && ctx.op === 'update') {
        return ctx.filters.id === 'l1'
          ? { data: [{ id: 'l1' }], error: null }
          : { data: null, error: { code: 'XX000', message: 'db hiccup' } };
      }
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(500);
    const revert = dbCalls.find(c => c.table === 'orders' && c.op === 'update' && c.payload?.status === 'pending');
    expect(revert).toBeDefined();
    expect(revert.filters).toMatchObject({ id: order.id, status: 'payment_confirmed' });
    expect(revert.payload.order_items.find(l => l.id === 'l1').sold_claimed).toBe(true);
    expect(revert.payload.order_items.find(l => l.id === 'l2').sold_claimed).toBeUndefined();
    // Nothing else ran: no stock moved, nobody paid, no refund alert.
    expect(rpcCalls).toHaveLength(0);
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    expect(doubleSaleAlerts()).toHaveLength(0);
  });

  it('on the retry, does not re-claim (and lose to) the listing it already won', async () => {
    const order = makeOrder([
      { type: 'listing', id: 'l1', seller_id: 's1', line_total_aud: 50, commission_aud: 0, sold_claimed: true },
      { type: 'listing', id: 'l2', seller_id: 's2', line_total_aud: 50, commission_aud: 0 },
    ]);
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: order, error: null };
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [{ id: order.id }], error: null };
      // l1 is already 'sold' (by this order) — a re-claim would match 0 rows.
      if (ctx.table === 'listings' && ctx.op === 'update') {
        return ctx.filters.id === 'l2' ? { data: [{ id: 'l2' }], error: null } : { data: [], error: null };
      }
      if (ctx.table === 'profiles' && ctx.single) {
        return { data: { email: null, display_name: 'X', stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true }, error: null };
      }
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(listingUpdates().map(c => c.filters.id)).toEqual(['l2']);
    expect(doubleSaleAlerts()).toHaveLength(0);
    // Both sellers are paid.
    expect(mockStripe.transfers.create).toHaveBeenCalledTimes(2);
  });
});

// ─── Single-item shipping address (Stripe API 2025-03-31+) ─────────────────────

describe('single-item shipping address', () => {
  it('reads the Stripe-collected address from collected_information.shipping_details', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_ship', amount_total: 10000, payment_intent: 'pi_ship',
          customer_details: { name: 'Billing Name' },
          collected_information: {
            shipping_details: {
              name: 'Ship To',
              address: { line1: '1 George St', city: 'Sydney', state: 'NSW', postal_code: '2000', country: 'AU' },
            },
          },
          metadata: {
            userId: 'buyer-1', listingId: 'l1', sellerId: 'seller-1',
            itemPrice: '100', commissionPct: '0', commissionAud: '0', gstAud: '0', sellerProceedsAud: '100',
          },
        },
      },
    });
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: null, error: null };
      return { data: null, error: null };
    };

    await postWebhook();

    const insert = dbCalls.find(c => c.table === 'orders' && c.op === 'insert');
    expect(insert.payload).toMatchObject({
      shipping_name: 'Ship To',
      shipping_address: '1 George St',
      shipping_suburb: 'Sydney',
      shipping_state: 'NSW',
      shipping_postcode: '2000',
    });
  });

  it('still falls back to a legacy top-level shipping_details', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_ship_old', amount_total: 10000, payment_intent: 'pi_ship_old',
          shipping_details: { address: { line1: '2 Pitt St', city: 'Sydney', state: 'NSW', postal_code: '2000' } },
          metadata: {
            userId: 'buyer-1', listingId: 'l1', sellerId: 'seller-1',
            itemPrice: '100', commissionPct: '0', commissionAud: '0', gstAud: '0', sellerProceedsAud: '100',
          },
        },
      },
    });
    state.respond = () => ({ data: null, error: null });

    await postWebhook();

    const insert = dbCalls.find(c => c.table === 'orders' && c.op === 'insert');
    expect(insert.payload).toMatchObject({ shipping_address: '2 Pitt St', shipping_postcode: '2000' });
  });
});
