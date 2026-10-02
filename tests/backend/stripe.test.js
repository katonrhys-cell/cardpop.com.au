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

// stripeClient lazy-requires the SDK via createRequire (see src/utils/stripeClient.js),
// which bypasses ESM module mocks — so mock the client module itself.
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));
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
// Admin promo-code lookups (promo_codes) get their own mock so they don't
// consume the queued partner/listing reads. Default: no such promo code.
const mockPromoMaybeSingle = vi.hoisted(() => vi.fn());
// The buy-side identity gate (requireIdentityForMarketplacePurchase) reads
// profiles.is_verified for the authenticated buyer. Default it to a verified
// buyer so the existing checkout tests exercise the happy path; tests that want
// an unverified buyer can override this.
const mockProfileMaybeSingle = vi.hoisted(() => vi.fn());
// The pending-order insert on the `orders` table — controllable so a test can
// simulate the missing-column (PGRST204) retry path.
const mockOrdersInsert = vi.hoisted(() => vi.fn());

// Replace only the fulfilment entrypoint so the success-page fallback (and the
// webhook dispatch) can be asserted directly; every other service export stays
// real (cartService and the routes import getPlatformSetting from this module).
const mockFulfil = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/stripeWebhookService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, handleCheckoutSessionCompleted: mockFulfil };
});

vi.mock('../../src/utils/supabaseClient.js', () => {
  const chain = (table) => {
    const q = {};
    q.select = () => q;
    q.eq = () => q;
    q.neq = () => q;
    q.order = () => q;
    q.limit = () => q;
    q.range = () => q;
    q.update = () => q;
    q.contains = () => q;
    // Partner promo codes are matched case-insensitively (partners.code).
    q.ilike = () => q;
    q.single = () => Promise.resolve({ data: null, error: null });
    // The identity gate's profiles lookup uses its own mock so it doesn't
    // consume the generic listing/offer mock the handlers rely on.
    q.maybeSingle = () => {
      if (table === 'profiles') return mockProfileMaybeSingle();
      if (table === 'promo_codes') return mockPromoMaybeSingle();
      return mockMaybeSingle();
    };
    q.insert = (payload) => (table === 'orders'
      ? mockOrdersInsert(payload)
      : Promise.resolve({ data: null, error: null }));
    return q;
  };
  const sb = { from: (table) => chain(table), auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) } };
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
  mockPromoMaybeSingle.mockResolvedValue({ data: null, error: null });
  // Buyer is identity-verified by default (passes the marketplace buy gate).
  mockProfileMaybeSingle.mockResolvedValue({ data: { is_verified: true }, error: null });
  // Pending-order insert succeeds by default.
  mockOrdersInsert.mockResolvedValue({ data: null, error: null });
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

  // calculateBreakdown then calculateProcessingFee read these settings in this
  // exact order, so queue them in it. The blanket mockResolvedValue in
  // beforeEach answers every read with the listing row (whose `.value` is
  // undefined), which would leave the commission NaN and price no fee at all.
  const pricingSettings = () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: false }, error: null })          // email_verification_required
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null })              // listing lookup
      .mockResolvedValueOnce({ data: { value: true }, error: null })           // commissions_enabled
      .mockResolvedValueOnce({ data: { value: true }, error: null })           // commission_on_fixed
      .mockResolvedValueOnce({ data: { id: 'fc-1', fee_pct: 3 }, error: null }) // fee_config
      .mockResolvedValueOnce({ data: { value: true }, error: null })           // processing_fee_enabled
      .mockResolvedValueOnce({ data: { value: 1.9 }, error: null })            // processing_fee_pct
      .mockResolvedValueOnce({ data: { value: 0.35 }, error: null })           // processing_fee_fixed_aud
      .mockResolvedValueOnce({ data: { value: true }, error: null })           // gst_enabled
      .mockResolvedValueOnce({ data: { value: 10 }, error: null });            // gst_rate_pct
  };

  it('charges the buyer a grossed-up processing fee line that covers Stripe’s cut', async () => {
    pricingSettings();
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });
    const res = await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);

    expect(res.status).toBe(200);
    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    const feeLine = sessionArgs.line_items.find(li => li.price_data.product_data.name === 'Payment processing');
    expect(feeLine).toBeDefined();
    // $99.99 item + $3.00 commission (no GST line — prices are GST-inclusive),
    // so ceil((10299 × 1.9% + 35) / (1 − 1.9%)) = 236¢.
    expect(feeLine.price_data.unit_amount).toBe(236);
    // And no GST is charged on top of any of it.
    expect(sessionArgs.line_items.some(li => /GST/i.test(li.price_data.product_data.name))).toBe(false);

    // The fee must cover what Stripe actually takes from the whole captured
    // amount (AU domestic card: 1.75% + $0.30) — that is the point of it.
    const totalCents = sessionArgs.line_items.reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0);
    expect(feeLine.price_data.unit_amount).toBeGreaterThanOrEqual(Math.round(totalCents * 0.0175 + 30));

    // And the buyer's quoted total is the sum of the lines — no hidden extra.
    expect(res.body.breakdown.total).toBe(totalCents / 100);
    expect(res.body.breakdown.processingAud).toBe(2.36);
  });

  it('deducts GST from the seller and never the processing fee', async () => {
    pricingSettings();
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });
    await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);

    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    const { processingFeeAud, sellerGstAud, platformGstAud, sellerProceedsAud } = sessionArgs.metadata;

    // The GST inside the $99.99 listing price: 1/11 = $9.09, withheld from the
    // seller for CardPop to remit.
    expect(Number(sellerGstAud)).toBe(9.09);
    // CardPop's own: 1/11 of 2 × $3.00 commission + $2.36 processing.
    expect(Number(platformGstAud)).toBe(0.76);
    // $99.99 − $3.00 commission − $9.09 GST + $0 postage. The buyer's
    // processing fee is nowhere in it.
    expect(Number(processingFeeAud)).toBe(2.36);
    expect(Number(sellerProceedsAud)).toBe(87.9);
  });

  it('has Stripe collect an Australian-only shipping address (the modal collects none)', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });
    await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);

    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(sessionArgs.shipping_address_collection).toEqual({ allowed_countries: ['AU'] });
  });

  it('refuses a supplied non-Australian address', async () => {
    mockMaybeSingle.mockResolvedValue({ data: MOCK_LISTING, error: null });
    const res = await request(app).post('/create-checkout').send({
      ...VALID_CHECKOUT_BODY,
      shippingAddress: { name: 'A Buyer', address: '1 Main St', suburb: 'Austin', state: 'TX', postcode: '73301' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('au_only');
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('pins the payment methods so no BNPL option can be offered', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });
    await request(app).post('/create-checkout').send(VALID_CHECKOUT_BODY);

    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(sessionArgs.payment_method_types).toEqual(['card', 'paypal']);
    expect(sessionArgs.payment_method_types).not.toContain('afterpay_clearpay');
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
          seller_id: 'seller-999',
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

  // The forged-seller attack (2026-09-21 audit): an offer on this listing that
  // an accomplice account "accepted" must never price the checkout, however
  // consented its status looks.
  it('rejects an accepted offer whose seller is not the listing seller', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: false }, error: null }) // email_verification_required (gate off)
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null }) // listing lookup
      .mockResolvedValueOnce({
        data: {
          amount_aud: 1,
          counter_amount_aud: null,
          status: 'accepted',
          buyer_id: 'user-123',
          seller_id: 'accomplice-1',
          listing_id: 'listing-1',
        },
        error: null,
      }); // offer lookup

    const res = await request(app).post('/create-checkout').send({ ...VALID_CHECKOUT_BODY, offerId: 'offer-forged' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid offer');
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("charges the counter amount when the buyer accepted the counter first (status 'accepted', counter set)", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: false }, error: null }) // email_verification_required (gate off)
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null }) // listing lookup
      .mockResolvedValueOnce({
        data: {
          amount_aud: 50,
          counter_amount_aud: 80,
          status: 'accepted',
          buyer_id: 'user-123',
          seller_id: 'seller-999',
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

  it("rejects checkout on a 'pending' offer the seller never consented to", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: false }, error: null }) // email_verification_required (gate off)
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null }) // listing lookup
      .mockResolvedValueOnce({
        data: {
          amount_aud: 1,
          counter_amount_aud: null,
          status: 'pending',
          buyer_id: 'user-123',
          seller_id: 'seller-999',
          listing_id: 'listing-1',
        },
        error: null,
      }); // offer lookup

    const res = await request(app).post('/create-checkout').send({ ...VALID_CHECKOUT_BODY, offerId: 'offer-1' });

    expect(res.status).toBe(400);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('never trusts a client-supplied bidId to change the commission transaction type', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.com/pay/cs_1' });

    const res = await request(app).post('/create-checkout').send({ ...VALID_CHECKOUT_BODY, bidId: 'fake-bid-id' });

    expect(res.status).toBe(200);
    const [[sessionArgs]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(sessionArgs.metadata.transactionType).toBe('fixed');
  });
});

// ─── GET /calculate ───────────────────────────────────────────────────────────

describe('GET /calculate', () => {
  it('prices an offer-based preview from the agreed offer amount, not the listing price', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null }) // listing lookup ($99.99)
      .mockResolvedValueOnce({
        data: {
          amount_aud: 50,
          counter_amount_aud: 80,
          status: 'accepted',
          buyer_id: 'user-123',
          seller_id: 'seller-999',
          listing_id: 'listing-1',
        },
        error: null,
      }) // offer lookup
      .mockResolvedValueOnce({ data: { value: false }, error: null }) // commissions_enabled
      .mockResolvedValueOnce({ data: { value: false }, error: null }) // gst_enabled
      .mockResolvedValueOnce({ data: { value: 10 }, error: null }) // gst_rate_pct
      .mockResolvedValueOnce({ data: { value: false }, error: null }); // gst_on_commission_only

    const res = await request(app).get('/calculate?listingId=listing-1&offerId=offer-1&transactionType=offer');

    expect(res.status).toBe(200);
    expect(res.body.itemPrice).toBe(80);
    expect(res.body.transactionType).toBe('offer');
  });

  it("rejects an offer preview for a 'pending' offer (mirrors the checkout gate)", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: MOCK_LISTING, error: null }) // listing lookup
      .mockResolvedValueOnce({
        data: {
          amount_aud: 1,
          counter_amount_aud: null,
          status: 'pending',
          buyer_id: 'user-123',
          seller_id: 'seller-999',
          listing_id: 'listing-1',
        },
        error: null,
      }); // offer lookup

    const res = await request(app).get('/calculate?listingId=listing-1&offerId=offer-1');

    expect(res.status).toBe(400);
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
    expect(res.body.deliveryCountry).toBeNull();
    expect(res.body.hasPreorder).toBe(false);
  });

  // Feeds the Google Customer Reviews opt-in on the success page.
  it('returns the shipping country and flags pre-order lines', async () => {
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_2',
      payment_status: 'paid',
      amount_total: 5000,
      customer_details: { email: 'buyer@example.com' },
      collected_information: { shipping_details: { address: { country: 'AU' } } },
      line_items: {
        data: [{ description: 'Binder — Black (Pre-order — Late November)', quantity: 1, price: { unit_amount: 5000, currency: 'aud' } }],
      },
    });
    const res = await request(app).get('/session/cs_2');
    expect(res.status).toBe(200);
    expect(res.body.deliveryCountry).toBe('AU');
    expect(res.body.hasPreorder).toBe(true);
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

  it('prices a shop product with GST included in the price (no commission)', async () => {
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    });
    const res = await request(app).post('/calculate-cart').send({ items: [{ type: 'shop', id: 'p1', quantity: 2 }] });
    expect(res.status).toBe(200);
    // $200 GST-inclusive: GST ($18.18) is inside it, not added. On top sits the
    // processing fee at the seeded default rate: ceil((20000 × 1.9% + 35) /
    // (1 − 1.9%)) = 424¢, grossed up so it still covers Stripe's cut of the
    // larger total it creates.
    expect(res.body.subtotalAud).toBe(200);
    expect(res.body.commissionAud).toBe(0);
    expect(res.body.gstAud).toBe(0);            // nothing added on top
    // $200 of GST-inclusive stock (round(20000 × 10/110) = 1818¢) plus the GST
    // inside CardPop's own $4.24 processing fee (round(424 × 10/110) = 39¢).
    expect(res.body.includedGstAud).toBe(18.57);
    expect(res.body.shippingAud).toBe(0);
    expect(res.body.processingAud).toBe(4.24);
    expect(res.body.totalAud).toBe(204.24);
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
    // $50 GST-inclusive item + $9.95 shipping = $59.95, then $1.52 processing
    // (the fee is charged on shipping too — Stripe takes its cut of that as well).
    expect(res.body.subtotalAud).toBe(50);
    expect(res.body.gstAud).toBe(0);
    expect(res.body.shippingAud).toBe(9.95);
    expect(res.body.processingAud).toBe(1.52);
    expect(res.body.totalAud).toBe(61.47);
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
    // $200 GST-inclusive, over the $100 free-shipping threshold → no shipping,
    // $4.24 processing.
    expect(res.body.subtotalAud).toBe(200);
    expect(res.body.shippingAud).toBe(0);
    expect(res.body.totalAud).toBe(204.24);
  });

  // A partner code is resolved BEFORE the cart is priced, so its lookup is the
  // first maybeSingle the handler makes — queued ahead of the pricing reads.
  const partnerRow = (overrides = {}) => mockMaybeSingle.mockResolvedValueOnce({
    data: {
      id: 'partner-1', user_id: 'partner-user', code: 'CREATOR10',
      discount_pct: 0, commission_pct: 5, free_shipping: true, status: 'approved',
      ...overrides,
    },
    error: null,
  });

  it('charges the shipping fee even for a partner row still flagged free_shipping', async () => {
    partnerRow();
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Single Card', price_aud: 50, stock_quantity: 5, status: 'active' },
      error: null,
    });
    shippingSettings(9.95, 100);
    const res = await request(app).post('/calculate-cart').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }],
      promoCode: 'CREATOR10',
    });
    expect(res.status).toBe(200);
    // The perk is retired: shipping under the threshold is mandatory.
    expect(res.body.shippingAud).toBe(9.95);
    expect(res.body).not.toHaveProperty('freeShipping');
    expect(res.body.totalAud).toBe(61.47);
    // 0% off and no shipping waiver — the code saves the buyer nothing.
    expect(res.body.promoError).toBe('This code applies to CardPop Shop items only.');
  });

  it('charges shipping alongside a partner code discount', async () => {
    partnerRow({ free_shipping: false, discount_pct: 10 });
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Single Card', price_aud: 50, stock_quantity: 5, status: 'active' },
      error: null,
    });
    shippingSettings(9.95, 100);
    const res = await request(app).post('/calculate-cart').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }],
      promoCode: 'CREATOR10',
    });
    expect(res.status).toBe(200);
    expect(res.body.shippingAud).toBe(9.95);
    // $50 + $9.95 shipping + $1.52 processing − $5 (10% of the shop subtotal).
    expect(res.body.discountAud).toBe(5);
    expect(res.body.totalAud).toBe(56.47);
  });

  it('reports a 0%-off partner code as doing nothing on an order that ships free', async () => {
    partnerRow();
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    });
    shippingSettings(9.95, 100);
    const res = await request(app).post('/calculate-cart').send({
      items: [{ type: 'shop', id: 'p1', quantity: 2 }],
      promoCode: 'CREATOR10',
    });
    expect(res.status).toBe(200);
    // Already over the threshold, and a 0%-off code that saved the buyer
    // nothing says so.
    expect(res.body.promoError).toBe('This code applies to CardPop Shop items only.');
    expect(res.body.totalAud).toBe(204.24);
  });

  // Admin promo codes (Admin → Promo Codes) are matched before partner codes.
  const promoRow = (overrides = {}) => mockPromoMaybeSingle.mockResolvedValueOnce({
    data: {
      id: 'promo-1', code: 'SPRING25', discount_pct: 25, applies_to: 'shop',
      usage_type: 'ongoing', max_redemptions: null, once_per_customer: false,
      min_order_aud: null, max_discount_aud: null, starts_at: null, expires_at: null,
      issued_to_email: null, restrict_to_email: false, active: true,
      ...overrides,
    },
    error: null,
  });
  const shopCard = () => mockMaybeSingle.mockResolvedValueOnce({
    data: { id: 'p1', title: 'Single Card', price_aud: 50, stock_quantity: 5, status: 'active' },
    error: null,
  });
  const pricePromo = (code = 'SPRING25') => request(app).post('/calculate-cart').send({
    items: [{ type: 'shop', id: 'p1', quantity: 1 }],
    promoCode: code,
  });

  it('applies an admin promo code’s percentage to the shop subtotal', async () => {
    promoRow();
    gstSettings();
    shopCard();
    shippingSettings(9.95, 100);
    const res = await pricePromo('spring25');
    expect(res.status).toBe(200);
    expect(res.body.promoError).toBeNull();
    // 25% of the $50 shop subtotal.
    expect(res.body.discountAud).toBe(12.5);
    expect(res.body.totalAud).toBe(48.97);
  });

  it('caps a promo discount at its maximum dollar amount', async () => {
    promoRow({ discount_pct: 50, max_discount_aud: 10 });
    gstSettings();
    shopCard();
    shippingSettings(9.95, 100);
    const res = await pricePromo();
    expect(res.body.discountAud).toBe(10);
  });

  it('reports an expired promo code without discounting', async () => {
    promoRow({ expires_at: new Date(Date.now() - 60_000).toISOString() });
    gstSettings();
    shopCard();
    shippingSettings(9.95, 100);
    const res = await pricePromo();
    expect(res.status).toBe(200);
    expect(res.body.promoError).toBe('That promo code has expired.');
    expect(res.body.discountAud).toBe(0);
  });

  it('refuses a code locked to someone else’s email', async () => {
    promoRow({ restrict_to_email: true, issued_to_email: 'friend@example.com' });
    gstSettings();
    shopCard();
    shippingSettings(9.95, 100);
    const res = await pricePromo();
    expect(res.body.promoError).toBe('That promo code isn’t valid for your account.');
    expect(res.body.discountAud).toBe(0);
  });

  it('enforces a minimum spend', async () => {
    promoRow({ min_order_aud: 80 });
    gstSettings();
    shopCard();
    shippingSettings(9.95, 100);
    const res = await pricePromo();
    expect(res.body.promoError).toMatch(/minimum spend of \$80\.00/);
    expect(res.body.discountAud).toBe(0);
  });
});

describe('POST /create-cart-checkout', () => {
  // Every cart checkout now needs an Australian delivery address: the
  // Australia-only gate runs before pricing and, unlike the Amazon Location
  // geocode, never fails open when no API key is configured.
  const AU_ADDRESS = { name: 'A Buyer', address: '1 Test St', suburb: 'Sydney', state: 'NSW', postcode: '2000' };

  it('returns 400 when items is missing', async () => {
    const res = await request(app).post('/create-cart-checkout').send({ successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when successUrl/cancelUrl are missing', async () => {
    const res = await request(app).post('/create-cart-checkout').send({ items: [{ type: 'shop', id: 'p1' }] });
    expect(res.status).toBe(400);
  });

  it('refuses a non-Australian delivery address', async () => {
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b',
      shippingAddress: { name: 'A Buyer', address: '1 Main St', suburb: 'Austin', state: 'TX', postcode: '73301' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('au_only');
    // Rejected before anything is priced or charged.
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses an address that names a non-Australian country even with an AU-shaped state', async () => {
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b',
      shippingAddress: { ...AU_ADDRESS, country: 'NZ' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('au_only');
  });

  it('refuses a missing address rather than failing open', async () => {
    // The Amazon Location geocode fails open when no API key is set (as in
    // tests, and in any environment where the key isn't configured), so before
    // the Australia gate an addressless cart checked out fine.
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('au_only');
  });

  it('returns 409 when a shop item is out of stock', async () => {
    emailVerifyOff();
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 0, status: 'active' },
      error: null,
    });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
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
      items: [{ type: 'listing', id: 'l1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for an unknown item type', async () => {
    // Unknown item types are now rejected by cart-input validation before any
    // pricing, so no GST/product reads happen — don't queue them (leftover
    // mockResolvedValueOnce values would bleed into later tests).
    emailVerifyOff();
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'mystery', id: 'x' }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
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
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
    });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://stripe.com/pay/cs_cart');
    // $100 shop item is GST-inclusive (no shipping mocked) → $100 + $2.30
    // processing.
    expect(res.body.total).toBe(102.3);
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
  });

  it('retries the order insert without gst_included_aud when the column is missing (PGRST204)', async () => {
    // Reproduces the production checkout failure: production ran the code that
    // writes gst_included_aud before its migration reached the DB, so PostgREST
    // rejected the insert with PGRST204 ("Could not find the 'gst_included_aud'
    // column ... in the schema cache"). The retry must fire so the buyer isn't
    // shown "Something went wrong."
    emailVerifyOff();
    gstSettings();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    });
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_cart', url: 'https://stripe.com/pay/cs_cart' });
    mockOrdersInsert
      .mockResolvedValueOnce({ error: { code: 'PGRST204', message: "Could not find the 'gst_included_aud' column of 'orders' in the schema cache" } })
      .mockResolvedValueOnce({ error: null });

    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
    });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://stripe.com/pay/cs_cart');
    // Inserted twice: the second attempt must drop the missing column.
    expect(mockOrdersInsert).toHaveBeenCalledTimes(2);
    expect('gst_included_aud' in mockOrdersInsert.mock.calls[1][0]).toBe(false);
  });

  it('blocks checkout with 403 when email verification is required and the buyer is unverified', async () => {
    // requireEmailVerified reads the flag first; ON + a user with no
    // email_confirmed_at (the auth mock) must be rejected before any pricing.
    mockMaybeSingle.mockResolvedValueOnce({ data: { value: true }, error: null });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('blocks a marketplace listing purchase with 403 when the buyer is not identity-verified', async () => {
    mockProfileMaybeSingle.mockResolvedValue({ data: { is_verified: false }, error: null });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'listing', id: 'l1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IDENTITY_NOT_VERIFIED');
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('does NOT apply the identity gate to a shop-only cart', async () => {
    // Even with an unverified buyer, a CardPop Shop order is not gated on
    // identity — it proceeds past the gate (and fails later only if pricing does).
    mockProfileMaybeSingle.mockResolvedValue({ data: { is_verified: false }, error: null });
    const res = await request(app).post('/create-cart-checkout').send({
      items: [{ type: 'shop', id: 'p1', quantity: 1 }], successUrl: 'https://example.com/a', cancelUrl: 'https://example.com/b', shippingAddress: AU_ADDRESS,
    });
    expect(res.body.code).not.toBe('IDENTITY_NOT_VERIFIED');
  });
});
