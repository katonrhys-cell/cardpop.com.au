import { describe, it, expect, beforeEach, vi } from 'vitest';

const fresh = async () => { vi.resetModules(); return import('@/lib/consent.js'); };

beforeEach(() => { window.localStorage.clear(); });

describe('consent', () => {
  it('starts undecided and has no marketing consent', async () => {
    const c = await fresh();
    expect(c.getConsent()).toBeNull();
    expect(c.hasMarketingConsent()).toBe(false);
  });

  it('persists the choice and notifies listeners', async () => {
    const c = await fresh();
    const seen = [];
    c.onConsentChange((v) => seen.push(v));
    c.setConsent(c.CONSENT_ALL);
    expect(c.getConsent()).toBe('all');
    expect(c.hasMarketingConsent()).toBe(true);
    c.setConsent(c.CONSENT_ESSENTIAL);
    expect(c.hasMarketingConsent()).toBe(false);
    c.resetConsent();
    expect(c.getConsent()).toBeNull();
    expect(seen).toEqual(['all', 'essential', null]);
  });

  it('ignores garbage in storage', async () => {
    window.localStorage.setItem('cardpop_cookie_consent', 'yes please');
    const c = await fresh();
    expect(c.getConsent()).toBeNull();
  });

  it('rejects unknown values', async () => {
    const c = await fresh();
    expect(() => c.setConsent('maybe')).toThrow();
  });
});
