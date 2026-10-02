import { vi, describe, it, expect, beforeEach } from 'vitest';

// Trade-only and Expression-of-Interest listings stay status 'active' with
// price_aud = null. Neither the cart pricer nor the single-item checkout used to
// look at listing_type, so such a card checked out for $0 + postage. Only a
// buy-now ('fixed') listing with a real price may be bought outright; an EOI
// listing may only be bought through a seller-accepted offer.

const db = vi.hoisted(() => ({ listing: null, offer: null }));

vi.mock('../../src/utils/supabaseClient.js', () => {
  const chain = (table) => {
    const q = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve({
      data: table === 'listings' ? db.listing : table === 'offers' ? db.offer : null,
      error: null,
    });
    q.then = (f, r) => Promise.resolve({ data: [], error: null }).then(f, r);
    return q;
  };
  const sb = { from: (t) => chain(t) };
  return { supabase: sb, default: sb };
});

vi.mock('../../src/services/stripeWebhookService.js', () => ({
  getPlatformSetting: vi.fn(async (_k, d) => d),
}));

vi.mock('../../src/services/commissionService.js', () => ({
  calculateBreakdown: vi.fn(async (l) => ({
    itemPrice: Number(l.price_aud) || 0, commissionAud: 0, commissionPct: 0, total: Number(l.price_aud) || 0, configId: null,
  })),
  calculateProcessingFee: vi.fn(async () => 0),
  calculateGst: vi.fn(async () => ({ sellerGstAud: 0, platformGstAud: 0, gstIncludedAud: 0 })),
  gstInsideCents: vi.fn(() => 0),
}));

const mockStripe = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));
vi.mock('../../src/utils/purchaseVelocity.js', () => ({ checkPurchaseVelocity: vi.fn(async () => ({ allowed: true })) }));
vi.mock('../../src/utils/returnUrl.js', () => ({ invalidReturnUrl: () => null }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { priceCart } from '../../src/services/cartService.js';
import { createSingleItemCheckout } from '../../src/services/checkoutService.js';

const baseListing = {
  id: 'l1', price_aud: 50, shipping_cost_aud: 10, seller_id: 'seller-1', status: 'active',
  vault_item: { card_name: 'Pikachu' }, seller: { seller_tier: 'standard' },
};

function runCheckout(body) {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  const req = {
    user: { id: 'buyer-1', email: 'b@example.com' },
    body: { listingId: 'l1', successUrl: 'https://cardpop.com.au/s', cancelUrl: 'https://cardpop.com.au/c', ...body },
  };
  return createSingleItemCheckout(req, res).then(() => res);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.listing = null;
  db.offer = null;
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/cs_1' });
});

describe('priceCart — listing purchasability', () => {
  it.each([
    ['trade-only', { listing_type: 'trade', price_aud: null }],
    ['expression of interest', { listing_type: 'expression_of_interest', price_aud: null }],
    ['auction', { listing_type: 'auction', price_aud: 20 }],
    ['fixed with no price', { listing_type: 'fixed', price_aud: null }],
    ['fixed priced at $0', { listing_type: 'fixed', price_aud: 0 }],
  ])('refuses a %s listing', async (_label, patch) => {
    db.listing = { ...baseListing, ...patch };
    await expect(priceCart([{ type: 'listing', id: 'l1' }], 'buyer-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('prices a buy-now listing', async () => {
    db.listing = { ...baseListing, listing_type: 'fixed' };
    const priced = await priceCart([{ type: 'listing', id: 'l1' }], 'buyer-1');
    expect(priced.itemsCents).toBe(5000);
    expect(priced.shippingCents).toBe(1000);
  });

  it('treats a legacy row with no listing_type as buy-now', async () => {
    db.listing = { ...baseListing, listing_type: null };
    const priced = await priceCart([{ type: 'listing', id: 'l1' }], 'buyer-1');
    expect(priced.itemsCents).toBe(5000);
  });
});

describe('createSingleItemCheckout — listing purchasability', () => {
  it('refuses Buy Now on an Expression of Interest listing (null price)', async () => {
    db.listing = { ...baseListing, listing_type: 'expression_of_interest', price_aud: null };
    const res = await runCheckout({});
    expect(res.statusCode).toBe(409);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses Buy Now on a trade-only listing', async () => {
    db.listing = { ...baseListing, listing_type: 'trade', price_aud: null };
    const res = await runCheckout({});
    expect(res.statusCode).toBe(409);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses an auction listing (there is no bidding flow to buy it through)', async () => {
    db.listing = { ...baseListing, listing_type: 'auction', price_aud: 20 };
    const res = await runCheckout({ bidId: 'anything' });
    expect(res.statusCode).toBe(409);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('allows an Expression of Interest listing bought through an accepted offer', async () => {
    db.listing = { ...baseListing, listing_type: 'expression_of_interest', price_aud: null };
    db.offer = {
      amount_aud: 80, counter_amount_aud: null, status: 'accepted', buyer_id: 'buyer-1',
      seller_id: 'seller-1', listing_id: 'l1', expires_at: null, payment_due_at: null, paid_at: null,
    };
    const res = await runCheckout({ offerId: 'offer-1' });
    expect(res.statusCode).toBe(200);
    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items[0].price_data.unit_amount).toBe(8000);
    expect(args.metadata.transactionType).toBe('offer');
  });

  it('allows a normal buy-now listing', async () => {
    db.listing = { ...baseListing, listing_type: 'fixed' };
    const res = await runCheckout({});
    expect(res.statusCode).toBe(200);
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
  });
});
