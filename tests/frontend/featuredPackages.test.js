import { describe, it, expect } from 'vitest';
import {
  FEATURED_PACKAGES, EARLY_BIRD, featuredQuote, featureEligibility, daysUntilEvent,
  isEarlyBird, formatAud, todayInAustralia, BUNDLE, bundleCents, featuredBundleQuote,
} from '@/utils/featuredPackages.js';

const TODAY = '2026-11-10';

describe('featured packages', () => {
  it('offers the three agreed packages, cheapest first', () => {
    expect(FEATURED_PACKAGES.map((p) => [p.key, p.priceAud])).toEqual([
      ['spotlight', 49], ['spotlight_instagram', 99], ['full', 149],
    ]);
    expect(EARLY_BIRD).toEqual({ pct: 20, minDays: 28 });
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
    expect(featuredQuote('full', '2026-11-20', TODAY)).toMatchObject({
      baseCents: 14900, discountCents: 0, priceCents: 14900, earlyBird: false,
    });
    expect(featuredQuote('nope', '2026-12-08', TODAY)).toBeNull();
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
      const q = featuredBundleQuote('full', [LATER, SOON, LATER], TODAY);
      // 359 / 3 = 119.67, 119.67, 119.66; 20% off the two early-bird shares.
      expect(q.lines.map((l) => [l.earlyBird, l.priceCents])).toEqual([[true, 9573], [false, 11967], [true, 9572]]);
      expect(q.priceCents).toBe(9573 + 11967 + 9572);
      expect(q.earlyBird).toBe(true);
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
});
