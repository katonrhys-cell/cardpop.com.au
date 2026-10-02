import { describe, it, expect } from 'vitest';
import {
  estimatedDeliveryDate,
  isBadgeEligiblePath,
  normaliseDeliveryCountry,
  renderSurveyOptIn,
} from '@/lib/googleCustomerReviews.js';

describe('estimatedDeliveryDate', () => {
  it('counts business days only, skipping the weekend', () => {
    // Thu 1 Oct 2026 + 5 business days → Thu 8 Oct
    expect(estimatedDeliveryDate(new Date(2026, 9, 1), 5)).toBe('2026-10-08');
    // Fri 2 Oct + 1 → Mon 5 Oct
    expect(estimatedDeliveryDate(new Date(2026, 9, 2), 1)).toBe('2026-10-05');
    // Sat 3 Oct + 1 → Mon 5 Oct
    expect(estimatedDeliveryDate(new Date(2026, 9, 3), 1)).toBe('2026-10-05');
  });

  it('formats as YYYY-MM-DD across a year boundary', () => {
    expect(estimatedDeliveryDate(new Date(2026, 11, 30), 3)).toBe('2027-01-04');
  });
});

describe('isBadgeEligiblePath', () => {
  it('shows the badge on public pages', () => {
    for (const p of ['/', '/marketplace', '/shop/binders/x', '/blog/some-post']) {
      expect(isBadgeEligiblePath(p)).toBe(true);
    }
  });

  it('never starts it on checkout, sign-in or admin', () => {
    for (const p of ['/checkout', '/checkout-success', '/success', '/login', '/admin/offers', '/ADMIN/']) {
      expect(isBadgeEligiblePath(p)).toBe(false);
    }
  });

  it('does not treat a shared prefix as a match', () => {
    expect(isBadgeEligiblePath('/administrators-guide')).toBe(true);
  });
});

describe('renderSurveyOptIn', () => {
  it('does nothing off a production build', () => {
    expect(renderSurveyOptIn({ orderId: 'cs_test_1', email: 'a@b.com' })).toBe(false);
    expect(document.querySelector('script[src*="apis.google.com"]')).toBeNull();
  });
});

describe('normaliseDeliveryCountry', () => {
  it('passes a valid ISO alpha-2 code through, upper-cased', () => {
    expect(normaliseDeliveryCountry('AU')).toBe('AU');
    expect(normaliseDeliveryCountry(' nz ')).toBe('NZ');
  });

  it('falls back to AU for missing, malformed or "ZZ" codes', () => {
    for (const bad of [null, undefined, '', 'AUS', 'A', '12', 'zz']) {
      expect(normaliseDeliveryCountry(bad)).toBe('AU');
    }
  });
});
