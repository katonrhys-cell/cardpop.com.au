import { vi, describe, it, expect, beforeEach } from 'vitest';

// resolveOfferPrice is the one gate between an offer and a Stripe checkout at
// the offer's price — every rule it enforces is a way a buyer could otherwise
// pay less than the seller agreed to.
const mockOffer = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/supabaseClient.js', () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockOffer }) }) }) };
  return { default: client, supabase: client };
});
vi.mock('../../../src/utils/stripeClient.js', () => ({ default: {} }));

import { resolveOfferPrice } from '../../../src/services/checkoutService.js';

const BUYER = 'buyer-1';
const SELLER = 'seller-1';
const LISTING = 'listing-1';
const HOUR = 3600 * 1000;

const offer = (extra = {}) => ({
  amount_aud: 4000, counter_amount_aud: null, status: 'accepted',
  buyer_id: BUYER, seller_id: SELLER, listing_id: LISTING,
  expires_at: new Date(Date.now() + 10 * HOUR).toISOString(),
  ...extra,
});
const resolve = () => resolveOfferPrice({ offerId: 'o1', listingId: LISTING, userId: BUYER, listingSellerId: SELLER });

beforeEach(() => vi.clearAllMocks());

describe('resolveOfferPrice', () => {
  it('prices an accepted offer at the buyer’s amount', async () => {
    mockOffer.mockResolvedValue({ data: offer() });
    expect(await resolve()).toEqual({ itemPrice: 4000 });
  });

  it('prices a live counter at the seller’s counter amount', async () => {
    mockOffer.mockResolvedValue({ data: offer({ status: 'countered', counter_amount_aud: 4500 }) });
    expect(await resolve()).toEqual({ itemPrice: 4500 });
  });

  it('still honours an accepted offer after its original response window (expires_at) — only the payment window applies', async () => {
    mockOffer.mockResolvedValue({ data: offer({ expires_at: new Date(Date.now() - HOUR).toISOString() }) });
    expect(await resolve()).toEqual({ itemPrice: 4000 });
  });

  it('prices an accepted offer inside its payment window', async () => {
    mockOffer.mockResolvedValue({ data: offer({ payment_due_at: new Date(Date.now() + HOUR).toISOString() }) });
    expect(await resolve()).toEqual({ itemPrice: 4000 });
  });

  it('refuses an accepted offer whose 48-hour payment window has closed', async () => {
    mockOffer.mockResolvedValue({ data: offer({ payment_due_at: new Date(Date.now() - HOUR).toISOString() }) });
    expect(await resolve()).toEqual({ error: 'The payment window for this offer has closed' });
  });

  it('refuses an offer that has already been paid for', async () => {
    mockOffer.mockResolvedValue({ data: offer({ paid_at: new Date().toISOString() }) });
    expect(await resolve()).toEqual({ error: 'This offer has already been paid for' });
  });

  it('refuses a counter whose 48-hour window has lapsed', async () => {
    mockOffer.mockResolvedValue({ data: offer({ status: 'countered', counter_amount_aud: 4500, expires_at: new Date(Date.now() - HOUR).toISOString() }) });
    expect(await resolve()).toEqual({ error: 'This counter offer has expired' });
  });

  it.each(['pending', 'declined', 'expired', 'withdrawn'])('refuses a %s offer (no seller consent)', async (status) => {
    mockOffer.mockResolvedValue({ data: offer({ status }) });
    expect(await resolve()).toHaveProperty('error');
  });

  it('refuses someone else’s offer, another listing’s offer, or a seller mismatch', async () => {
    mockOffer.mockResolvedValue({ data: offer({ buyer_id: 'someone-else' }) });
    expect(await resolve()).toEqual({ error: 'Invalid offer' });
    mockOffer.mockResolvedValue({ data: offer({ listing_id: 'other' }) });
    expect(await resolve()).toEqual({ error: 'Invalid offer' });
    mockOffer.mockResolvedValue({ data: offer({ seller_id: 'accomplice' }) });
    expect(await resolve()).toEqual({ error: 'Invalid offer' });
    mockOffer.mockResolvedValue({ data: null });
    expect(await resolve()).toEqual({ error: 'Invalid offer' });
  });
});
