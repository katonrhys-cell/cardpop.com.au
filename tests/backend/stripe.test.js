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
  optionalAuthMiddleware: (req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
}));
const mockMaybeSingle = vi.hoisted(() => vi.fn());

// Replace only the fulfilment entrypoint so the success-page fallback (and the
// webhook dispatch) can be asserted directly; every other service export stays
// real (cartService and the routes import getPlatformSetting from this module).
const mockFulfil = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/stripeWebhookService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, handleCheckoutSessionCompleted: mockFulfil };
});

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

  it("charges the seller's counter amount, not the buyer's original offer, when checking out on a countered offer", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: false }, error: null }) // email_verification_required (gate off)
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null }) // listing lookup
      .mockResolvedValueOnce({
        data: {
          amount_aud: 50,
          counter_amount_aud: 80,
          status: 'countered',
          buyer_id: 'user-123',
          listing_id: 'listing-1',
        },
        error: null,
      }); // offer lookup
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });

    const res = await request(app).post('/create-checkout').send({ ...VALID_CHECKOUT_BODY, offerId: 'offer-1' });

    expect(res.status).toBe(200);
    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    const itemLine = sessionArgs.line_items.find((li) => li.price_data.product_data.name === 'Charizard VMAX');
    expect(itemLine.price_data.unit_amount).toBe(8000);
  });

  it('never trusts a client-supplied bidId to change the commission transaction type', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });

    const res = await request(app).post('/create-checkout').send({ ...VALID_CHECKOUT_BODY, bidId: 'fake-bid-id' });

    expect(res.status).toBe(200);
    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(sessionArgs.metadata.transactionType).toBe('fixed');
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

  // The success page proves payment completed, so the route also fulfils the
  // order (idempotently) — the webhook fallback that keeps a paid-for listing
  // from staying 'active' and buyable when webhook delivery is down.
  describe('fulfilment fallback', () => {
    const paidSession = {
      id: 'cs_paid',
      mode: 'payment',
      payment_status: 'paid',
      amount_total: 500,
      metadata: { userId: 'user-123', listingId: 'listing-1' },
      customer_details: { email: 'buyer@example.com' },
      line_items: { data: [] },
    };

    it('fulfils a paid payment-mode session with the session retrieved from Stripe', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue(paidSession);
      const res = await request(app).get('/session/cs_paid');
      expect(res.status).toBe(200);
      expect(mockFulfil).toHaveBeenCalledTimes(1);
      expect(mockFulfil.mock.calls[0][0]).toBe(paidSession);
    });

    it('does not fulfil an unpaid session', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({ ...paidSession, payment_status: 'unpaid' });
      const res = await request(app).get('/session/cs_paid');
      expect(res.status).toBe(200);
      expect(mockFulfil).not.toHaveBeenCalled();
    });

    it('does not fulfil a wallet top-up session', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        ...paidSession,
        metadata: { ...paidSession.metadata, walletTopup: 'true' },
      });
      const res = await request(app).get('/session/cs_paid');
      expect(res.status).toBe(200);
      expect(mockFulfil).not.toHaveBeenCalled();
    });

    it('does not fulfil a subscription session', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({ ...paidSession, mode: 'subscription' });
      const res = await request(app).get('/session/cs_paid');
      expect(res.status).toBe(200);
      expect(mockFulfil).not.toHaveBeenCalled();
    });

    it("does not fulfil (or leak) another user's session", async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        ...paidSession,
        metadata: { ...paidSession.metadata, userId: 'someone-else' },
      });
      const res = await request(app).get('/session/cs_paid');
      expect(res.status).toBe(403);
      expect(mockFulfil).not.toHaveBeenCalled();
    });

    it('still returns the receipt when fulfilment throws (webhook retries cover it)', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue(paidSession);
      mockFulfil.mockRejectedValueOnce(new Error('db down'));
      const res = await request(app).get('/session/cs_paid');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('cs_paid');
    });
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

// The checkout routes now run requireEmailVerified first, which reads the
// email_verification_required flag via one maybeSingle. Queue it OFF so the
// gate passes and the following mocks line up with the handler's own reads.
const emailVerifyOff = () => mockMaybeSingle.mockResolvedValueOnce({ data: { value: false }, error: null });

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
    expect(res.body.shippingAud).toBe(0);
    expect(res.body.totalAud).toBe(220);
  });

  // priceCart reads the two shipping settings AFTER the item loop, so queue them
  // last (rate then threshold). Both come from Platform Settings (Admin → Listings).
  const shippingSettings = (rate, threshold) => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: rate }, error: null })       // default_shipping_rate_aud
      .mockResolvedValueOnce({ data: { value: threshold }, error: null }); // free_shipping_threshold_aud
  };

  it('charges the flat shipping rate on a shop order below the free-shipping threshold', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Single Card', price_aud: 50, stock_quantity: 5, status: 'active' },
      error: null,
    });
    shippingSettings(9.95, 100);
    const res = await request(app).post('/calculate-cart').send({ items: [{ type: 'shop', id: 'p1', quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotalAud).toBe(50);
    expect(res.body.gstAud).toBe(5);
    expect(res.body.shippingAud).toBe(9.95);
    expect(res.body.totalAud).toBe(64.95);
  });

  it('gives free shipping once the shop subtotal reaches the threshold', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    });
    shippingSettings(9.95, 100);
    const res = await request(app).post('/calculate-cart').send({ items: [{ type: 'shop', id: 'p1', quantity: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotalAud).toBe(200);
    expect(res.body.shippingAud).toBe(0);
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
    emailVerifyOff();
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
    emailVerifyOff();
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
    // Unknown item types are now rejected by cart-input validation before any
    // pricing, so no GST/product reads happen — don't queue them (leftover
    // mockResolvedValueOnce values would bleed into later tests).
    emailVerifyOff();
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'mystery', id: 'x' }], successUrl: 'a', cancelUrl: 'b',
    });
    expect(res.status).toBe(400);
  });

  it('creates a Stripe session and returns the URL for a valid shop cart', async () => {
    emailVerifyOff();
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

  it('blocks checkout with 403 when email verification is required and the buyer is unverified', async () => {
    // requireEmailVerified reads the flag first; ON + a user with no
    // email_confirmed_at (the auth mock) must be rejected before any pricing.
    mockMaybeSingle.mockResolvedValueOnce({ data: { value: true }, error: null });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'a', cancelUrl: 'b',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
