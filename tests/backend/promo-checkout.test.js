import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Admin promo codes at cart checkout: the route reserves one use of the code
// before minting the session's coupon, carries the reservation on the session
// metadata (so the webhook can redeem or release it), and hands the
// reservation back if the session can't be created.

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
  orderLines: [{ type: 'shop', id: 'p1', line_total_aud: 100 }],
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

const promo = vi.hoisted(() => ({
  row: {
    id: 'promo-1', code: 'MATE20', discount_pct: 20, applies_to: 'shop', usage_type: 'single_use',
    once_per_customer: true, active: true,
  },
}));
const promoSvc = vi.hoisted(() => ({
  findPromoCode: vi.fn(),
  validatePromoCode: vi.fn(async (p) => p),
  reservePromoCode: vi.fn(async () => 'red-1'),
  attachPromoSession: vi.fn(async () => {}),
  releasePromoRedemption: vi.fn(async () => {}),
}));
vi.mock('../../src/services/promoCodeService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ...promoSvc,
}));

import stripeRouter from '../../src/routes/stripe.js';

const app = express();
app.use(express.json());
app.use('/', stripeRouter);

const ITEMS = [{ type: 'shop', id: 'p1' }];
const ADDRESS = { name: 'B', address: '1 George St', suburb: 'Sydney', state: 'NSW', postcode: '2000', country: 'AU' };
const checkout = () => request(app).post('/create-cart-checkout').send({
  items: ITEMS, successUrl: 'https://cardpop.com.au/s', cancelUrl: 'https://cardpop.com.au/c',
  shippingAddress: ADDRESS, promoCode: 'mate20',
});

beforeEach(() => {
  vi.clearAllMocks();
  ordersInserts.length = 0;
  promoSvc.findPromoCode.mockResolvedValue(promo.row);
  promoSvc.validatePromoCode.mockImplementation(async (p) => p);
  promoSvc.reservePromoCode.mockResolvedValue('red-1');
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/cs_1' });
  mockStripe.coupons.create.mockResolvedValue({ id: 'coupon_1' });
});

describe('POST /create-cart-checkout — admin promo code', () => {
  it('reserves a use, applies the coupon and tags the session', async () => {
    const res = await checkout();
    expect(res.status).toBe(200);
    expect(promoSvc.validatePromoCode).toHaveBeenCalledWith(promo.row, { userId: 'buyer-1', email: 'b@example.com' });
    // 20% of the $100 shop subtotal.
    expect(promoSvc.reservePromoCode).toHaveBeenCalledWith(promo.row, { userId: 'buyer-1', email: 'b@example.com', discountCents: 2000 });
    expect(mockStripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ amount_off: 2000, currency: 'aud', duration: 'once' }));
    const [[args]] = mockStripe.checkout.sessions.create.mock.calls;
    expect(args.discounts).toEqual([{ coupon: 'coupon_1' }]);
    expect(args.metadata).toMatchObject({ promoRedemptionId: 'red-1', promoCode: 'MATE20' });
    expect(args.metadata.partnerId).toBeUndefined();
    expect(ordersInserts[0]).toMatchObject({ discount_aud: 20, total_aud: 87.5 });
    expect(promoSvc.attachPromoSession).toHaveBeenCalledWith('red-1', 'cs_1');
    expect(promoSvc.releasePromoRedemption).not.toHaveBeenCalled();
  });

  it('hands the reservation back when the session can’t be created', async () => {
    mockStripe.checkout.sessions.create.mockRejectedValue(new Error('stripe down'));
    const res = await checkout();
    expect(res.status).toBe(500);
    expect(promoSvc.releasePromoRedemption).toHaveBeenCalledWith('red-1');
  });

  it('refuses a used-up code before creating anything', async () => {
    promoSvc.reservePromoCode.mockRejectedValue(Object.assign(new Error('That promo code has already been used.'), { statusCode: 409 }));
    const res = await checkout();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('That promo code has already been used.');
    expect(mockStripe.coupons.create).not.toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
