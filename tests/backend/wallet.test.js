import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Buyer prepaid wallet: balance lives entirely on the Stripe Customer object
// (customer.balance), never in our DB. These tests cover the /wallet routes
// and the webhook's wallet-topup / wallet-debit branches.

const mockStripe = vi.hoisted(() => ({
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
    createBalanceTransaction: vi.fn(),
  },
  // list() backs the wallet double-spend guard (assertNoOpenWalletCheckout);
  // default to no open sessions so the wallet checkout path proceeds.
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn(), list: vi.fn().mockResolvedValue({ data: [] }) } },
  coupons: { create: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
}));

// stripeClient lazy-requires the SDK via createRequire (see src/utils/stripeClient.js),
// which bypasses ESM module mocks — so mock the client module itself.
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'user-123', email: 'buyer@example.com' };
    next();
  },
  optionalAuthMiddleware: (req, _res, next) => {
    req.user = { id: 'user-123', email: 'buyer@example.com' };
    next();
  },
}));

vi.mock('../../src/utils/emailService.js', () => ({
  sendOrderConfirmed: vi.fn().mockResolvedValue(undefined),
  sendItemSold: vi.fn().mockResolvedValue(undefined),
}));

// ─── Programmable Supabase mock (same shape as stripe-webhook-idempotency.test.js) ───

const dbCalls = vi.hoisted(() => []);
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
      eq(k, v) { ctx.filters[k] = v; return builder; },
      is(k, v) { ctx.filters[k] = v; return builder; },
      neq() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      maybeSingle() { ctx.single = true; return exec(); },
      single() { ctx.single = true; return exec(); },
      then(onF, onR) { return exec().then(onF, onR); },
      catch(onR) { return exec().catch(onR); },
    };
    return builder;
  }
  const sb = {
    from: (t) => makeBuilder(t),
    // reserve_wallet_checkout returns a boolean "acquired" flag; default to
    // acquired so wallet-checkout happy paths proceed. Other RPCs return null.
    rpc: (fn) => Promise.resolve({ data: fn === 'reserve_wallet_checkout' ? true : null, error: null }),
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  };
  return { supabase: sb, default: sb };
});

import walletRouter from '../../src/routes/wallet.js';
import stripeRouter from '../../src/routes/stripe.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/wallet', walletRouter);
  app.use('/', stripeRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  dbCalls.length = 0;
  state.respond = () => ({ data: null, error: null });
});

describe('GET /wallet/balance', () => {
  it('returns 0 when the profile has no linked Stripe customer', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.single) return { data: { stripe_customer_id: null }, error: null };
      return { data: null, error: null };
    };

    const res = await request(app).get('/wallet/balance');
    expect(res.status).toBe(200);
    expect(res.body.balanceAud).toBe(0);
    expect(mockStripe.customers.retrieve).not.toHaveBeenCalled();
  });

  it('reads the live balance from the Stripe customer (negative balance = credit)', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.single) return { data: { stripe_customer_id: 'cus_1' }, error: null };
      return { data: null, error: null };
    };
    mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_1', balance: -2500, deleted: false });

    const res = await request(app).get('/wallet/balance');
    expect(res.status).toBe(200);
    expect(res.body.balanceAud).toBe(25);
  });

  it('returns 0 when the stored customer id no longer exists (platform switched Stripe accounts)', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.single) return { data: { stripe_customer_id: 'cus_stale' }, error: null };
      return { data: null, error: null };
    };
    mockStripe.customers.retrieve.mockRejectedValueOnce(
      Object.assign(new Error('No such customer: cus_stale'), { code: 'resource_missing' }),
    );

    const res = await request(app).get('/wallet/balance');
    expect(res.status).toBe(200);
    expect(res.body.balanceAud).toBe(0);
  });
});

describe('POST /wallet/topup', () => {
  const validBody = {
    amountAud: 50,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
  };

  it('rejects an amount outside the allowed range', async () => {
    const res = await request(app).post('/wallet/topup').send({ ...validBody, amountAud: 1 });
    expect(res.status).toBe(400);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('creates (or reuses) a Stripe customer and a Checkout Session for the top-up', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.single) return { data: { stripe_customer_id: 'cus_existing' }, error: null };
      return { data: null, error: null };
    };
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_topup', url: 'https://stripe.test/session' });

    const res = await request(app).post('/wallet/topup').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://stripe.test/session');
    expect(mockStripe.customers.create).not.toHaveBeenCalled(); // reused existing customer
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        mode: 'payment',
        metadata: { userId: 'user-123', walletTopup: 'true' },
      }),
    );
  });

  it('recreates the customer when the stored id no longer exists (platform switched Stripe accounts)', async () => {
    let storedId = 'cus_stale';
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.op === 'update' && ctx.payload?.stripe_customer_id) {
        storedId = ctx.payload.stripe_customer_id;
        return { data: null, error: null };
      }
      if (ctx.table === 'profiles' && ctx.single) return { data: { stripe_customer_id: storedId }, error: null };
      return { data: null, error: null };
    };
    mockStripe.customers.retrieve.mockRejectedValueOnce(
      Object.assign(new Error('No such customer: cus_stale'), { code: 'resource_missing' }),
    );
    mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_new' });
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_topup', url: 'https://stripe.test/session' });

    const res = await request(app).post('/wallet/topup').send(validBody);

    expect(res.status).toBe(200);
    expect(mockStripe.customers.create).toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_new' }),
    );
  });
});

describe('Webhook: wallet top-up completion', () => {
  it('credits the Stripe customer balance idempotently on checkout.session.completed', async () => {
    const session = {
      id: 'cs_topup_1',
      customer: 'cus_existing',
      amount_total: 5000,
      metadata: { userId: 'user-123', walletTopup: 'true' },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_existing',
      { amount: -5000, currency: 'aud', description: 'CardPop wallet top-up' },
      { idempotencyKey: 'wallet-topup-cs_topup_1' },
    );
    // Must not be routed through the regular order-confirmation path.
    expect(dbCalls.some(c => c.table === 'orders' && c.op === 'insert')).toBe(false);
  });
});

describe('Cart checkout: applying wallet balance', () => {
  it('rejects combining a promo code with wallet balance', async () => {
    const res = await request(app)
      .post('/calculate-cart')
      .send({ items: [{ type: 'shop', id: 'p1', quantity: 1 }], promoCode: 'POP-AAAA-BBBB', useWalletBalance: true });
    expect(res.status).toBe(400);
  });

  it('applies the wallet balance as a Stripe coupon on create-cart-checkout and debits it once payment completes', async () => {
    state.respond = (ctx) => {
      if (ctx.table === 'shop_products' && ctx.single) {
        return { data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' }, error: null };
      }
      if (ctx.table === 'profiles' && ctx.single) return { data: { stripe_customer_id: 'cus_existing' }, error: null };
      if (ctx.table === 'orders' && ctx.op === 'insert') return { data: null, error: null };
      return { data: null, error: null };
    };
    mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_existing', balance: -3000, deleted: false }); // $30 available
    mockStripe.coupons.create.mockResolvedValue({ id: 'coup_wallet' });
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_cart_wallet', url: 'https://stripe.test/cart' });

    const res = await request(app)
      .post('/create-cart-checkout')
      .send({
        items: [{ type: 'shop', id: 'p1', quantity: 1 }],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        useWalletBalance: true,
        // Checkout is Australia-only — every cart now needs a local address.
        shippingAddress: { name: 'A Buyer', address: '1 Test St', suburb: 'Sydney', state: 'NSW', postcode: '2000' },
      });

    expect(res.status).toBe(200);
    // $100 item + $10 GST (10% default) = $110, wallet covers $30 of it.
    expect(mockStripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount_off: 3000, currency: 'aud' }),
    );
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        metadata: expect.objectContaining({ walletCents: '3000' }),
      }),
    );

    // Now simulate the webhook confirming that session — the wallet should be
    // debited exactly the amount that was applied, exactly once.
    const pendingOrder = {
      id: 'order-1',
      status: 'pending',
      total_aud: 80, // (110 - 30) applied wallet discount
      order_items: [{ type: 'shop', id: 'p1', quantity: 1, seller_id: null }],
      buyer_id: 'user-123',
    };
    state.respond = (ctx) => {
      if (ctx.table === 'orders' && ctx.single) return { data: pendingOrder, error: null };
      if (ctx.table === 'orders' && ctx.op === 'update') return { data: [{ id: pendingOrder.id }], error: null };
      if (ctx.table === 'profiles' && ctx.single) return { data: { email: null, display_name: 'Buyer' }, error: null };
      return { data: null, error: null };
    };
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_cart_wallet',
          customer: 'cus_existing',
          amount_total: 8000,
          metadata: { walletCents: '3000' },
        },
      },
    });

    const webhookRes = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from('{}'));

    expect(webhookRes.status).toBe(200);
    expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_existing',
      { amount: 3000, currency: 'aud', description: 'Applied to order order-1' },
      { idempotencyKey: 'wallet-debit-cs_cart_wallet' },
    );
  });
});
