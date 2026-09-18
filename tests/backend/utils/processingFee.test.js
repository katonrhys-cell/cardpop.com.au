import { describe, it, expect } from 'vitest';
import { processingFeeCents } from '../../../src/utils/processingFee.js';

// Stripe AU domestic card pricing, for the "does the fee actually cover it?"
// assertions below. Anything the fee fails to cover is money CardPop loses on
// the sale, which is the whole reason this helper exists.
const STRIPE_RATE = 0.0175;
const STRIPE_FIXED = 30;
const stripeTakes = totalCents => Math.round(totalCents * STRIPE_RATE + STRIPE_FIXED);

// The configured rate: a deliberate margin over Stripe's own.
const CONFIG = { pct: 1.9, fixedCents: 35 };

describe('processingFeeCents', () => {
  it('grosses up so the fee covers Stripe’s cut of the total it is part of', () => {
    // The naive fee (rate × subtotal + fixed) under-collects, because Stripe
    // charges its percentage on the total *including* the fee.
    const subtotal = 12063; // the $120.63 worked example
    const fee = processingFeeCents(subtotal, CONFIG);
    const naive = Math.round(subtotal * 0.019 + 35);

    expect(fee).toBeGreaterThan(naive);
    expect(fee).toBe(270);
    expect(stripeTakes(subtotal + fee)).toBeLessThanOrEqual(fee);
  });

  it('covers Stripe at every order size from $1 to $5,000', () => {
    for (let subtotal = 100; subtotal <= 500000; subtotal += 137) {
      const fee = processingFeeCents(subtotal, CONFIG);
      expect(stripeTakes(subtotal + fee)).toBeLessThanOrEqual(fee);
    }
  });

  it('rounds up, never down — a rounded-down half cent is a loss on every order', () => {
    // 1000¢ × 1.9% + 35¢ = 54¢ exactly before the gross-up; the division then
    // leaves a fraction that must not be truncated.
    const fee = processingFeeCents(1000, CONFIG);
    expect(fee).toBe(Math.ceil((1000 * 0.019 + 35) / (1 - 0.019)));
    expect(Number.isInteger(fee)).toBe(true);
  });

  it('charges nothing on a zero, negative or non-numeric subtotal', () => {
    expect(processingFeeCents(0, CONFIG)).toBe(0);
    expect(processingFeeCents(-500, CONFIG)).toBe(0);
    expect(processingFeeCents(NaN, CONFIG)).toBe(0);
    expect(processingFeeCents(undefined, CONFIG)).toBe(0);
  });

  it('charges nothing when both components are zero (fee switched off by rate)', () => {
    expect(processingFeeCents(10000, { pct: 0, fixedCents: 0 })).toBe(0);
  });

  it('still charges the fixed component when the percentage is zero', () => {
    expect(processingFeeCents(10000, { pct: 0, fixedCents: 35 })).toBe(35);
  });

  it('clamps an absurd rate instead of billing the buyer a fortune', () => {
    // A settings typo of "19" for "1.9" must not produce a runaway gross-up
    // (the divisor approaches zero as the rate approaches 100%).
    const fee = processingFeeCents(10000, { pct: 900, fixedCents: 0 });
    expect(fee).toBe(processingFeeCents(10000, { pct: 50, fixedCents: 0 }));
    expect(fee).toBeLessThan(30000);
  });

  it('treats missing config as no fee rather than NaN', () => {
    expect(processingFeeCents(10000)).toBe(0);
    expect(processingFeeCents(10000, {})).toBe(0);
  });
});
