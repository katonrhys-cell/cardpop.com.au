import { describe, it, expect } from 'vitest';
import { listingTakesOffers, offerDisplayStatus, offerWindowState, formatOfferRange, OFFER_WINDOW_HOURS } from '@/utils/offerEligibility.js';

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

describe('expression of interest offer window', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  const past = '2026-10-01T00:00:00Z';
  const future = '2026-10-05T00:00:00Z';
  const eoi = (extra) => ({ listing_type: 'expression_of_interest', status: 'active', ...extra });

  it.each([
    ['no dates at all', {}, 'open'],
    ['opened in the past, no close', { offers_open_at: past }, 'open'],
    ['closes in the future, no open', { offers_close_at: future }, 'open'],
    ['inside both ends', { offers_open_at: past, offers_close_at: future }, 'open'],
    ['not open yet', { offers_open_at: future }, 'upcoming'],
    ['already closed', { offers_close_at: past }, 'closed'],
  ])('%s → %s', (_label, dates, expected) => {
    expect(offerWindowState(eoi(dates), now)).toBe(expected);
    expect(listingTakesOffers(eoi(dates), now)).toBe(expected === 'open');
  });
});

describe('formatOfferRange', () => {
  it('formats a full range, an open-ended minimum, and a bare maximum', () => {
    expect(formatOfferRange(80, 120)).toBe('$80.00 – $120.00');
    expect(formatOfferRange(80, null)).toBe('From $80.00');
    expect(formatOfferRange('80', '')).toBe('From $80.00');
    expect(formatOfferRange(null, 120)).toBe('Up to $120.00');
    expect(formatOfferRange(null, null)).toBeNull();
  });
});

describe('offerDisplayStatus', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  const before = '2026-09-29T23:00:00Z';
  const after = '2026-09-30T01:00:00Z';

  it.each([
    ['a live pending offer', { status: 'pending', expires_at: after }, 'pending'],
    ['a pending offer past expires_at', { status: 'pending', expires_at: before }, 'expired'],
    ['a live counter', { status: 'countered', expires_at: after }, 'countered'],
    ['a lapsed counter', { status: 'countered', expires_at: before }, 'expired'],
    ['an accepted offer inside the payment window', { status: 'accepted', payment_due_at: after }, 'accepted'],
    ['an accepted offer past the payment window', { status: 'accepted', payment_due_at: before }, 'expired'],
    ['an accepted offer whose response window passed (irrelevant once accepted)', { status: 'accepted', expires_at: before, payment_due_at: after }, 'accepted'],
    ['a paid offer, even past its payment window', { status: 'accepted', payment_due_at: before, paid_at: before }, 'paid'],
    ['a declined offer', { status: 'declined', expires_at: before }, 'declined'],
    ['nothing', null, 'expired'],
  ])('%s → %s', (_label, offer, expected) => {
    expect(offerDisplayStatus(offer, now)).toBe(expected);
  });
});
