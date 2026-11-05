import { describe, it, expect, beforeEach, vi } from 'vitest';
import { impactAllowedOn, initImpactTag, __resetImpactForTests, IMPACT_SCRIPT_SRC } from '@/lib/impactTag.js';
import { setConsent, resetConsent } from '@/lib/consent.js';

const impactScripts = () => [...document.querySelectorAll('script')].filter((s) => s.src === IMPACT_SCRIPT_SRC);

describe('Impact affiliate tag', () => {
  beforeEach(() => {
    __resetImpactForTests();
    impactScripts().forEach((s) => s.remove());
    delete window.impactStat;
    try { resetConsent(); } catch { /* storage may be blocked */ }
    document.head.appendChild(document.createElement('script'));
    window.history.replaceState({}, '', '/');
  });

  it('never starts on checkout, sign-in, account or admin pages', () => {
    expect(impactAllowedOn('/checkout')).toBe(false);
    expect(impactAllowedOn('/admin/orders')).toBe(false);
    expect(impactAllowedOn('/account/listings')).toBe(false);
    expect(impactAllowedOn('/shop/card-sleeves')).toBe(true);
    expect(impactAllowedOn('/checkout-success')).toBe(true);
  });

  it('waits for marketing consent before loading', () => {
    initImpactTag();
    expect(impactScripts()).toHaveLength(0);
    setConsent('all');
    expect(impactScripts()).toHaveLength(1);
    expect(typeof window.impactStat).toBe('function');
  });

  it('loads at once when consent was already given', () => {
    setConsent('all');
    initImpactTag();
    expect(impactScripts()).toHaveLength(1);
  });

  it('does not load for essential-only consent', () => {
    initImpactTag();
    setConsent('essential');
    expect(impactScripts()).toHaveLength(0);
  });
});
