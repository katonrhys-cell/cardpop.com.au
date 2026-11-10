import { describe, it, expect } from 'vitest';
import {
  FEATURED_PACKAGES, EARLY_BIRD, featuredQuote, featureEligibility, daysUntilEvent,
  isEarlyBird, formatAud, todayInAustralia,
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
});
