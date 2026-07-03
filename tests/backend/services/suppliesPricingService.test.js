import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../src/utils/supabaseClient.js', () => {
  const chain = () => {
    const q = {};
    q.select = () => q;
    q.eq = () => q;
    q.update = () => q;
    q.insert = () => Promise.resolve({ data: null, error: null });
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.then = (resolve) => resolve({ data: [], error: null });
    return q;
  };
  const sb = { from: () => chain() };
  return { supabase: sb, default: sb };
});

import {
  gstPortionCents,
  suggestRetailPriceAud,
  shippingFeeCents,
  SUPPLIES_SETTING_DEFAULTS,
} from '../../../src/services/suppliesPricingService.js';

describe('gstPortionCents', () => {
  it('extracts 1/11th of a GST-inclusive amount at the standard 10% rate', () => {
    expect(gstPortionCents(11000)).toBe(1000);   // $110.00 → $10.00 GST
    expect(gstPortionCents(20000)).toBe(1818);   // $200.00 → $18.18 GST
    expect(gstPortionCents(495)).toBe(45);       // $4.95 → $0.45 GST
  });

  it('returns 0 for zero, negative, or non-finite amounts', () => {
    expect(gstPortionCents(0)).toBe(0);
    expect(gstPortionCents(-500)).toBe(0);
    expect(gstPortionCents(NaN)).toBe(0);
  });

  it('returns 0 when GST is disabled (rate 0)', () => {
    expect(gstPortionCents(11000, 0)).toBe(0);
  });
});

describe('suggestRetailPriceAud', () => {
  it('applies the markup over cost and rounds UP to the nearest 5 cents', () => {
    // $3.00 cost at 60% markup = $4.80 exactly
    expect(suggestRetailPriceAud(3, 60)).toBe(4.8);
    // $2.47 cost at 60% markup = $3.952 → rounds up to $4.00, never down
    expect(suggestRetailPriceAud(2.47, 60)).toBe(4);
  });

  it('falls back to the default markup when markup is not a number', () => {
    const expected = Math.ceil(10 * (1 + SUPPLIES_SETTING_DEFAULTS.supplies_default_markup_pct / 100) * 20) / 20;
    expect(suggestRetailPriceAud(10, undefined)).toBe(expected);
  });

  it('returns null for a missing or non-positive cost', () => {
    expect(suggestRetailPriceAud(0, 60)).toBeNull();
    expect(suggestRetailPriceAud(null, 60)).toBeNull();
    expect(suggestRetailPriceAud('abc', 60)).toBeNull();
  });
});

describe('shippingFeeCents', () => {
  const THRESHOLD = 5000; // $50
  const FEE = 1000;       // $10

  it('charges the flat fee below the free-shipping threshold', () => {
    expect(shippingFeeCents(495, THRESHOLD, FEE)).toBe(1000);
    expect(shippingFeeCents(4999, THRESHOLD, FEE)).toBe(1000);
  });

  it('is free at and above the threshold', () => {
    expect(shippingFeeCents(5000, THRESHOLD, FEE)).toBe(0);
    expect(shippingFeeCents(12000, THRESHOLD, FEE)).toBe(0);
  });

  it('charges nothing when there are no shippable goods', () => {
    expect(shippingFeeCents(0, THRESHOLD, FEE)).toBe(0);
  });
});
