import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Cart checkout bookkeeping:
//  - the pending order row records platform_gst_aud (priceCart computes it, the
//    single-item path already stored it, the cart path dropped it);
//  - the /calculate-cart wallet preview applies the same cap as checkout
//    (leave Stripe's 50¢ minimum on the card), so the preview never promises
//    more credit than the session actually takes off.

const mockStripe = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
  coupons: { create: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'buyer-1', email: 'b@example.com' }; next(); },
  optionalAuthMiddleware: (req, _res, next) => { req.user = { id: 'buyer-1', email: 'b@example.com' }; next(); },
}));
vi.mock('../../src/middleware/requireEmailVerified.js', () => ({ requireEmailVerified: (_q, _s, n) => n() }));
vi.mock('../../src/middleware/requireIdentityForPurchase.js', () => ({ requireIdentityForMarketplacePurchase: (_q, _s, n) => n() }));
vi.mock('../../src/utils/purchaseVelocity.js', () => ({ checkPurchaseVelocity: vi.fn(async () => ({ allowed: true })) }));
vi.mock('../../src/utils/returnUrl.js', () => ({ invalidReturnUrl: () => null }));
vi.mock('../../src/utils/addressValidation.js', () => ({
  validateShippingAddress: vi.fn(async () => ({ valid: true })),
  checkAustralianAddress: vi.fn(() => ({ valid: true })),
  AU_ONLY_MESSAGE: 'AU only',
}));

const priced = vi.hoisted(() => ({
  lineItems: [{ price_data: { currency: 'aud', product_data: { name: 'Card' }, unit_amount: 10000 }, quantity: 1 }],
  orderLines: [{ type: 'listing', id: 'l1', seller_id: 's1' }],
  itemsCents: 10000, commissionCents: 500, gstCents: 0,
  includedGstCents: 1000, sellerGstCents: 909, platformGstCents: 91,
  shippingCents: 0, processingCents: 250, grandCents: 10750, hasPreorder: false,
}));
vi.mock('../../src/services/cartService.js', () => ({ priceCart: vi.fn(async () => ({ ...priced, orderLines: [...priced.orderLines] })) }));

const wallet = vi.hoisted(() => ({ balanceCents: 0 }));
vi.mock('../../src/services/walletService.js', () => ({
  ensureWalletCustomer: vi.fn(async () => 'cus_1'),
  getWalletBalanceCents: vi.fn(async () => wallet.balanceCents),
  handleWalletTopup: vi.fn(),
  assertNoOpenWalletCheckout: vi.fn(async () => {}),
  reserveWalletCheckout: vi.fn(async () => {}),
  releaseWalletCheckout: vi.fn(async () => {}),
}));

const ordersInserts = vi.hoisted(() => []);
vi.mock('../../src/utils/supabaseClient.js', () => {
  const chain = (table) => {
    const q = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit', 'update', 'ilike']) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.single = q.maybeSingle;
    q.insert = (row) => {
      if (table === 'orders') ordersInserts.push(row);
      return Promise.resolve({ data: null, error: null });
    };
    q.then = (f, r) => Promise.resolve({ data: null, error: null }).then(f, r);
    return q;
  };
  const sb = { from: (t) => chain(t), auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  return { supabase: sb, default: sb };
});

import stripeRouter from '../../src/routes/stripe.js';

const app = express();
app.use(express.json());
app.use('/', stripeRouter);

const ITEMS = [{ type: 'listing', id: 'l1' }];
const ADDRESS = { name: 'B', address: '1 George St', suburb: 'Sydney', state: 'NSW', postcode: '2000', country: 'AU' };

beforeEach(() => {
  vi.clearAllMocks();
  ordersInserts.length = 0;
  wallet.balanceCents = 0;
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/cs_1' });
  mockStripe.coupons.create.mockResolvedValue({ id: 'coupon_1' });
});

describe('POST /create-cart-checkout — pending order row', () => {
  it('records platform_gst_aud alongside seller_gst_aud and gst_included_aud', async () => {
    const res = await request(app).post('/create-cart-checkout').send({
      items: ITEMS, successUrl: 'https://cardpop.com.au/s', cancelUrl: 'https://cardpop.com.au/c', shippingAddress: ADDRESS,
    });
    expect(res.status).toBe(200);
    expect(ordersInserts).toHaveLength(1);
    expect(ordersInserts[0]).toMatchObject({
      platform_gst_aud: 0.91,
      seller_gst_aud: 9.09,
      gst_included_aud: 10,
    });
  });
});

describe('POST /create-cart-checkout — ui modes', () => {
  const RETURN = 'https://cardpop.com.au/checkout-success?session_id={CHECKOUT_SESSION_ID}';

  it("creates an 'elements' session (inline Google Pay) that returns a client secret", async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', client_secret: 'cs_1_secret' });
    const res = await request(app).post('/create-cart-checkout').send({
      items: ITEMS, uiMode: 'elements', returnUrl: RETURN, shippingAddress: ADDRESS,
    });
    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe('cs_1_secret');
    const [[args]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(args.ui_mode).toBe('elements');
    expect(args.return_url).toBe(RETURN);
    expect(args.success_url).toBeUndefined();
    // Google Pay rides on 'card' — the same pinned list as every other mode.
    expect(args.payment_method_types).toContain('card');
    expect(ordersInserts).toHaveLength(1);
  });

  it("keeps 'embedded' on Stripe's full embedded page", async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', client_secret: 'cs_1_secret' });
    await request(app).post('/create-cart-checkout').send({
      items: ITEMS, uiMode: 'embedded', returnUrl: RETURN, shippingAddress: ADDRESS,
    });
    const [[args]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(args.ui_mode).toBe('embedded_page');
  });

  it("requires a returnUrl for 'elements'", async () => {
    const res = await request(app).post('/create-cart-checkout').send({
      items: ITEMS, uiMode: 'elements', shippingAddress: ADDRESS,
    });
    expect(res.status).toBe(400);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe('wallet preview matches checkout', () => {
  it('caps the preview at the total minus Stripe\'s 50¢ minimum, exactly like checkout', async () => {
    wallet.balanceCents = 50000; // covers the whole $107.50 order

    const preview = await request(app).post('/calculate-cart').send({ items: ITEMS, useWalletBalance: true });
    expect(preview.status).toBe(200);
    expect(preview.body.walletAppliedAud).toBe(107);
    expect(preview.body.totalAud).toBe(0.5);

    const checkout = await request(app).post('/create-cart-checkout').send({
      items: ITEMS, successUrl: 'https://cardpop.com.au/s', cancelUrl: 'https://cardpop.com.au/c',
      shippingAddress: ADDRESS, useWalletBalance: true,
    });
    expect(checkout.status).toBe(200);
    expect(mockStripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ amount_off: 10700 }));
    expect(ordersInserts[0].discount_aud).toBe(preview.body.walletAppliedAud);
    expect(ordersInserts[0].total_aud).toBe(preview.body.totalAud);
  });

  it('applies a balance smaller than the total in full', async () => {
    wallet.balanceCents = 2000;
    const preview = await request(app).post('/calculate-cart').send({ items: ITEMS, useWalletBalance: true });
    expect(preview.body.walletAppliedAud).toBe(20);
    expect(preview.body.totalAud).toBe(87.5);
  });
});
