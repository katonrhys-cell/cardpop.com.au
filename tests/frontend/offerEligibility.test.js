import { describe, it, expect } from 'vitest';
import { listingTakesOffers, OFFER_WINDOW_HOURS } from '@/utils/offerEligibility.js';

// The same rule gates the "Make an Offer" button (ProductDetailPage), POST
// /offers, and — mirrored in SQL — the offers insert trigger.
describe('listingTakesOffers', () => {
  it.each([
    ['a buy-now listing (offers on by default)', { listing_type: 'fixed', accepts_offers: true }],
    ['a buy-now listing not yet backfilled', { listing_type: 'fixed', accepts_offers: null }],
    ['a buy-now listing with no type recorded', { accepts_offers: true }],
    ['an expression of interest, even with the flag off', { listing_type: 'expression_of_interest', accepts_offers: false }],
    ['an active listing', { listing_type: 'fixed', accepts_offers: true, status: 'active' }],
  ])('allows offers on %s', (_label, listing) => {
    expect(listingTakesOffers(listing)).toBe(true);
  });

  it.each([
    ['a buy-now listing whose seller turned offers off', { listing_type: 'fixed', accepts_offers: false }],
    ['a trade-only listing', { listing_type: 'trade', accepts_offers: true }],
    ['an auction', { listing_type: 'auction', accepts_offers: true }],
    ['a private vault item', { listing_type: 'vault', accepts_offers: true }],
    ['a sold listing', { listing_type: 'fixed', accepts_offers: true, status: 'sold' }],
    ['an archived listing', { listing_type: 'expression_of_interest', status: 'archived' }],
    ['nothing', null],
  ])('refuses offers on %s', (_label, listing) => {
    expect(listingTakesOffers(listing)).toBe(false);
  });

  it('binds offers for 48 hours', () => {
    expect(OFFER_WINDOW_HOURS).toBe(48);
  });
});
