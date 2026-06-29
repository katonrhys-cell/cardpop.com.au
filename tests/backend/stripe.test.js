import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mock stripe before importing the router ──────────────────────────────────

const mockStripe = vi.hoisted(() => ({
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
}));

vi.mock('stripe', () => ({ default: vi.fn(function () { return mockStripe; }) }));
// Stripe routes require auth — bypass Supabase token verification in tests
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
}));
const mockMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => {
  const chain = () => {
    const q = {};
    q.select = () => q;
    q.eq = () => q;
    q.neq = () => q;
    q.order = () => q;
    q.limit = () => q;
    q.range = () => q;
    q.update = () => q;
    q.contains = () => q;
    q.single = () => Promise.resolve({ data: null, error: null });
    q.maybeSingle = () => mockMaybeSingle();
    q.insert = () => Promise.resolve({ data: null, error: null });
    return q;
  };
  const sb = { from: () => chain(), auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) } };
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

const VALID_CHECKOUT_BODY = {
  listingId: 'listing-1',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
};

const MOCK_LISTING = {
  id: 'listing-1',
  price_aud: 99.99,
  title: 'Charizard VMAX',
  seller_id: 'seller-999',
  vault_item_id: 'vault-1',
  seller: { seller_tier: 'standard', display_name: 'Card Shop' },
  vault_item: { card_name: 'Charizard VMAX' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: MOCK_LISTING, error: null });
});

// ─── POST /create-checkout ────────────────────────────────────────────────────

describe('POST /create-checkout', () => {
  it('returns 400 when listingId is missing', async () => {
    const res = await request(app).post('/create-checkout').send({ successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when successUrl or cancelUrl is missing', async () => {
    const res = await request(app).post('/create-checkout').send({ listingId: 'listing-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 404 when listing is not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);
    expect(res.status).toBe(404);
  });

  it('returns the checkout session URL on success', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });
    const res = await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://stripe.com/pay/cs_1');
  });

  it('returns 500 when stripe returns a session without a URL', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: null });
    const res = await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);
    expect(res.status).toBe(500);
  });
});

// ─── GET /session/:sessionId ──────────────────────────────────────────────────

describe('GET /session/:sessionId', () => {
  it('returns 400 for a blank sessionId (whitespace)', async () => {
    // URL-encode the space so Express routes it to the handler, which then rejects it
    const res = await request(app).get('/session/%20');
    expect(res.status).toBe(400);
  });

  it('retrieves and formats session data from stripe', async () => {
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_1',
      payment_status: 'paid',
      amount_total: 9999,
      customer_details: { email: 'buyer@example.com' },
      line_items: {
        data: [{ description: 'Charizard', quantity: 1, price: { unit_amount: 9999, currency: 'aud' } }],
      },
    });
    const res = await request(app).get('/session/cs_1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('cs_1');
    expect(res.body.status).toBe('paid');
    expect(res.body.customerEmail).toBe('buyer@example.com');
    expect(res.body.items).toHaveLength(1);
  });
});

// ─── POST /webhook ────────────────────────────────────────────────────────────

describe('POST /webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing stripe-signature/i);
  });

  it('returns 400 when signature verification fails', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Signature mismatch');
    });
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid-sig')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature verification failed/i);
  });

  it('returns 200 received:true for a valid checkout.session.completed event', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1' } },
    });
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('returns 200 received:true for an unhandled but valid event type', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.created',
      data: { object: { id: 'cus_1' } },
    });
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─── Multi-item cart checkout ─────────────────────────────────────────────────

// priceCart reads gst_enabled then gst_rate_pct (via getPlatformSetting) before
// looking up each item, so queue those first.
const gstSettings = () => {
  mockMaybeSingle
    .mockResolvedValueOnce({ data: { value: true }, error: null })   // gst_enabled
    .mockResolvedValueOnce({ data: { value: 10 }, error: null });    // gst_rate_pct
};

describe('POST /calculate-cart', () => {
  it('returns 400 when items is empty', async () => {
    const res = await request(app).post('/calculate-cart').send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('prices a shop product with GST only (no commission)', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    });
    const res = await request(app).post('/calculate-cart').send({ items: [{ type: 'shop', id: 'p1', quantity: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotalAud).toBe(200);
    expect(res.body.commissionAud).toBe(0);
    expect(res.body.gstAud).toBe(20);
    expect(res.body.totalAud).toBe(220);
  });
});

describe('POST /create-cart-checkout', () => {
  it('returns 400 when items is missing', async () => {
    const res = await request(app).post('/create-cart-checkout').send({ successUrl: 'a', cancelUrl: 'b' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when successUrl/cancelUrl are missing', async () => {
    const res = await request(app).post('/create-cart-checkout').send({ items: [{ type: 'shop', id: 'p1' }] });
    expect(res.status).toBe(400);
  });

  it('returns 409 when a shop item is out of stock', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 0, status: 'active' },
      error: null,
    });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'a', cancelUrl: 'b',
    });
    expect(res.status).toBe(409);
  });

  it('returns 403 when buying your own listing', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'l1', price_aud: 50, seller_id: 'user-123', status: 'active', vault_item: { card_name: 'X' }, seller: { seller_tier: 'none' } },
      error: null,
    });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'listing', id: 'l1', quantity: 1 }], successUrl: 'a', cancelUrl: 'b',
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for an unknown item type', async () => {
    gstSettings();
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'mystery', id: 'x' }], successUrl: 'a', cancelUrl: 'b',
    });
    expect(res.status).toBe(400);
  });

  it('creates a Stripe session and returns the URL for a valid shop cart', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    });
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_cart', url: 'https://stripe.com/pay/cs_cart' });

    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'a', cancelUrl: 'b',
    });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://stripe.com/pay/cs_cart');
    expect(res.body.total).toBe(110);
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
  });
});
