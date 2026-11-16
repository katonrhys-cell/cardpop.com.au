import { describe, it, expect } from 'vitest';
import {
  FEATURED_PACKAGES, EARLY_BIRD, featuredQuote, featureEligibility, daysUntilEvent,
  isEarlyBird, formatAud, todayInAustralia, BUNDLE, bundleCents, featuredBundleQuote,
  EVENT_EXTRAS, EXTRAS_ENQUIRY_EMAIL, RETIRED_FEATURED_PACKAGES, eventExtra, isEventExtra, extraCents,
  extraEligibility, canBuyExtras, featuredPackage, purchaseName,
} from '@/utils/featuredPackages.js';

const TODAY = '2026-11-10';

describe('featured packages', () => {
  it('sells one featuring package, Calendar Spotlight', () => {
    expect(FEATURED_PACKAGES.map((p) => [p.key, p.priceAud])).toEqual([['spotlight', 49]]);
    expect(EARLY_BIRD).toEqual({ pct: 20, minDays: 28 });
    // Instagram and the homepage are no longer part of featuring.
    expect(JSON.stringify(FEATURED_PACKAGES)).not.toMatch(/instagram|homepage/i);
  });

  it('retires the Instagram and Full Feature packages but still names them', () => {
    expect(featuredPackage('spotlight_instagram')).toBeNull();
    expect(featuredPackage('full')).toBeNull();
    expect(Object.keys(RETIRED_FEATURED_PACKAGES)).toEqual(['spotlight_instagram', 'full']);
    expect(purchaseName('full')).toBe('Full Feature');
    expect(purchaseName('spotlight_instagram')).toBe('Spotlight + Instagram');
    expect(purchaseName('spotlight')).toBe('Calendar Spotlight');
    expect(purchaseName('review')).toBe('Full event review');
    expect(purchaseName('mystery')).toBe('mystery');
  });

  it('never mentions the newsletter', () => {
    expect(JSON.stringify(FEATURED_PACKAGES)).not.toMatch(/newsletter/i);
  });

  it('counts whole days to the show', () => {
    expect(daysUntilEvent('2026-12-08', TODAY)).toBe(28);
    expect(daysUntilEvent('2026-11-09', TODAY)).toBe(-1);
    expect(daysUntilEvent(null, TODAY)).toBeNull();
  });

  it('applies the early bird from four weeks out', () => {
    expect(isEarlyBird('2026-12-08', TODAY)).toBe(true);
    expect(isEarlyBird('2026-12-07', TODAY)).toBe(false);
    expect(featuredQuote('spotlight', '2026-12-08', TODAY)).toMatchObject({
      baseCents: 4900, discountCents: 980, priceCents: 3920, earlyBird: true,
    });
    expect(featuredQuote('spotlight', '2026-11-20', TODAY)).toMatchObject({
      baseCents: 4900, discountCents: 0, priceCents: 4900, earlyBird: false,
    });
    expect(featuredQuote('nope', '2026-12-08', TODAY)).toBeNull();
    expect(featuredQuote('full', '2026-12-08', TODAY)).toBeNull();
    expect(featuredQuote('post', '2026-12-08', TODAY)).toBeNull();
  });

  it('formats prices', () => {
    expect(formatAud(4900)).toBe('$49');
    expect(formatAud(3920)).toBe('$39.20');
  });

  it('only features submitted or live events that have not started', () => {
    const ev = { status: 'approved', start_date: '2026-11-20', is_featured: false };
    expect(featureEligibility(ev, TODAY).ok).toBe(true);
    expect(featureEligibility({ ...ev, status: 'pending_review' }, TODAY).ok).toBe(true);
    expect(featureEligibility({ ...ev, start_date: TODAY }, TODAY).ok).toBe(true);
    expect(featureEligibility({ ...ev, status: 'draft' }, TODAY).ok).toBe(false);
    expect(featureEligibility({ ...ev, status: 'rejected' }, TODAY).ok).toBe(false);
    expect(featureEligibility({ ...ev, start_date: '2026-11-09' }, TODAY).ok).toBe(false);
    expect(featureEligibility({ ...ev, is_featured: true }, TODAY).ok).toBe(false);
    expect(featureEligibility(ev, TODAY, { paid: true }).ok).toBe(false);
    expect(featureEligibility(null, TODAY).ok).toBe(false);
  });

  it('does not sell featuring for an event the Ultimate membership already spotlights', () => {
    const ev = { status: 'approved', start_date: '2026-11-20', is_featured: true, membership_featured: true };
    expect(featureEligibility(ev, TODAY)).toEqual({
      ok: false,
      reason: 'Calendar Spotlight is already included with your Ultimate membership. Instagram and event reviews are under Promote.',
    });
    // A paid or admin-pinned featuring keeps the ordinary message.
    expect(featureEligibility({ ...ev, membership_featured: false }, TODAY).reason).toBe('This event is already featured.');
    expect(featureEligibility(ev, TODAY, { paid: true }).reason).toBe('This event is already featured.');
  });

  it('dates bookings in Sydney time', () => {
    // 14:00 UTC on 10 Nov is 01:00 on 11 Nov in Sydney (AEDT).
    expect(todayInAustralia(new Date('2026-11-10T14:00:00Z'))).toBe('2026-11-11');
  });

  describe('3-event pack', () => {
    const SOON = '2026-11-20';
    const LATER = '2026-12-20';

    it('prices three events below three singles for every package', () => {
      expect(BUNDLE.size).toBe(3);
      for (const p of FEATURED_PACKAGES) {
        expect(bundleCents(p.key)).toBeLessThan(p.priceAud * 100 * BUNDLE.size);
      }
      expect(bundleCents('nope')).toBeNull();
    });

    it('splits the pack price so the lines add up to the charge', () => {
      const q = featuredBundleQuote('spotlight', [SOON, SOON, SOON], TODAY);
      expect(q.lines.map((l) => l.priceCents)).toEqual([3967, 3967, 3966]);
      expect(q).toMatchObject({ listCents: 14700, packCents: 11900, priceCents: 11900, savingCents: 2800, earlyBird: false });
      expect(q.lines.every((l) => l.baseCents === 4900 && l.discountCents === 4900 - l.priceCents)).toBe(true);
    });

    it('still takes the early bird off each far-off show', () => {
      const q = featuredBundleQuote('spotlight', [LATER, SOON, LATER], TODAY);
      // 119 / 3 = 39.67, 39.67, 39.66; 20% off the two early-bird shares.
      expect(q.lines.map((l) => [l.earlyBird, l.priceCents])).toEqual([[true, 3173], [false, 3967], [true, 3172]]);
      expect(q.priceCents).toBe(3173 + 3967 + 3172);
      expect(q.earlyBird).toBe(true);
    });

    it('has no pack for a retired package or an extra', () => {
      expect(Object.keys(BUNDLE.priceAud)).toEqual(['spotlight']);
      for (const key of ['spotlight_instagram', 'full', 'story', 'post', 'review']) {
        expect(bundleCents(key)).toBeNull();
        expect(featuredBundleQuote(key, [SOON, SOON, SOON], TODAY)).toBeNull();
      }
    });

    it('is never dearer than booking the three one by one', () => {
      for (const p of FEATURED_PACKAGES) {
        for (const dates of [[SOON, SOON, SOON], [LATER, LATER, LATER], [SOON, LATER, SOON]]) {
          const singles = dates.reduce((sum, d) => sum + featuredQuote(p.key, d, TODAY).priceCents, 0);
          expect(featuredBundleQuote(p.key, dates, TODAY).priceCents).toBeLessThan(singles);
        }
      }
    });

    it('needs exactly three events and a known package', () => {
      expect(featuredBundleQuote('spotlight', [SOON, SOON], TODAY)).toBeNull();
      expect(featuredBundleQuote('spotlight', [SOON, SOON, SOON, SOON], TODAY)).toBeNull();
      expect(featuredBundleQuote('gold', [SOON, SOON, SOON], TODAY)).toBeNull();
    });
  });

  describe('promotion extras', () => {
    const ev = { status: 'approved', start_date: '2026-11-20', is_featured: false };

    it('sells a story, a post and a full event review at the agreed prices', () => {
      expect(EVENT_EXTRAS.map((x) => [x.key, x.name, x.priceAud])).toEqual([
        ['story', 'Instagram story', 49], ['post', 'Instagram post', 99], ['review', 'Full event review', 199],
      ]);
      expect(EVENT_EXTRAS.map((x) => extraCents(x.key))).toEqual([4900, 9900, 19900]);
      expect(extraCents('spotlight')).toBeNull();
      expect(extraCents('nope')).toBeNull();
      expect(EXTRAS_ENQUIRY_EMAIL).toBe('admin@cardpop.com.au');
      for (const x of EVENT_EXTRAS) {
        expect(x.points.length).toBeGreaterThan(0);
        expect(x.todo.length).toBeGreaterThan(0);
      }
    });

    it('keeps extras apart from featuring: no shared keys, no placement promises', () => {
      const featuring = [...FEATURED_PACKAGES.map((p) => p.key), ...Object.keys(RETIRED_FEATURED_PACKAGES)];
      for (const x of EVENT_EXTRAS) {
        expect(featuring).not.toContain(x.key);
        expect(isEventExtra(x.key)).toBe(true);
        expect(featuredPackage(x.key)).toBeNull();
      }
      for (const key of featuring) expect(isEventExtra(key)).toBe(false);
      expect(eventExtra('nope')).toBeNull();
      expect(JSON.stringify(EVENT_EXTRAS)).not.toMatch(/featured events|homepage|newsletter/i);
    });

    it('states the review conditions: free entry, on the day only, post included', () => {
      const review = eventExtra('review');
      const terms = review.terms.join(' | ');
      expect(terms).toMatch(/free entry/i);
      expect(terms).toMatch(/on the day/i);
      expect(review.points.join(' | ')).toMatch(/Instagram post/);
      expect(review.todo.join(' | ')).toMatch(/free entry/i);
      expect(eventExtra('story').terms).toEqual([]);
      expect(eventExtra('post').terms).toEqual([]);
    });

    it('can be added to any submitted or live upcoming event, featured or not', () => {
      for (const x of EVENT_EXTRAS) {
        expect(extraEligibility(ev, x.key, TODAY)).toEqual({ ok: true, reason: null });
        expect(extraEligibility({ ...ev, status: 'pending_review' }, x.key, TODAY).ok).toBe(true);
        // A paid / admin-pinned featuring, and the Ultimate membership spotlight.
        expect(extraEligibility({ ...ev, is_featured: true }, x.key, TODAY).ok).toBe(true);
        expect(extraEligibility({ ...ev, is_featured: true, membership_featured: true }, x.key, TODAY).ok).toBe(true);
        expect(extraEligibility({ ...ev, start_date: TODAY }, x.key, TODAY).ok).toBe(true);
      }
    });

    it('is refused when already bought, started, undated, not submitted or unknown', () => {
      expect(extraEligibility(ev, 'post', TODAY, { bought: ['post'] })).toEqual({
        ok: false, reason: 'Instagram post is already booked for this event.',
      });
      // Another extra on the same event is still fine.
      expect(extraEligibility(ev, 'story', TODAY, { bought: ['post'] }).ok).toBe(true);
      expect(extraEligibility({ ...ev, start_date: '2026-11-09' }, 'post', TODAY).reason).toBe('This event has already started.');
      expect(extraEligibility({ ...ev, start_date: null }, 'post', TODAY).ok).toBe(false);
      expect(extraEligibility({ ...ev, status: 'draft' }, 'post', TODAY).ok).toBe(false);
      expect(extraEligibility({ ...ev, status: 'rejected' }, 'post', TODAY).ok).toBe(false);
      expect(extraEligibility({ ...ev, status: 'completed' }, 'post', TODAY).ok).toBe(false);
      expect(extraEligibility(null, 'post', TODAY)).toEqual({ ok: false, reason: 'Event not found.' });
      expect(extraEligibility(ev, 'gold', TODAY)).toEqual({ ok: false, reason: 'Choose an extra.' });
      expect(extraEligibility(ev, 'spotlight', TODAY).ok).toBe(false);
    });

    it('canBuyExtras is true while at least one extra is left to buy', () => {
      expect(canBuyExtras(ev, TODAY)).toBe(true);
      expect(canBuyExtras({ ...ev, is_featured: true, membership_featured: true }, TODAY)).toBe(true);
      expect(canBuyExtras(ev, TODAY, { bought: ['story', 'post'] })).toBe(true);
      expect(canBuyExtras(ev, TODAY, { bought: ['story', 'post', 'review'] })).toBe(false);
      expect(canBuyExtras({ ...ev, status: 'draft' }, TODAY)).toBe(false);
      expect(canBuyExtras({ ...ev, start_date: '2026-11-09' }, TODAY)).toBe(false);
      expect(canBuyExtras(null, TODAY)).toBe(false);
    });
  });
});
