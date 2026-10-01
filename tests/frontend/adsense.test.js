import { describe, it, expect, beforeEach, vi } from 'vitest';

const scripts = () => document.querySelectorAll('script[src*="googlesyndication"]');

// The loader caches its promise at module scope (one script per page), so each
// test imports a fresh copy of the module.
const freshLoader = async () => {
  vi.resetModules();
  return import('@/lib/adsense.js');
};

beforeEach(() => {
  scripts().forEach((s) => s.remove());
});

describe('loadAdsenseScript', () => {
  it('injects the AdSense loader with the publisher client id', async () => {
    const { loadAdsenseScript, ADSENSE_CLIENT } = await freshLoader();
    loadAdsenseScript();

    expect(scripts()).toHaveLength(1);
    const script = scripts()[0];
    expect(script.src).toBe(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`);
    expect(script.async).toBe(true);
    expect(script.crossOrigin).toBe('anonymous');
  });

  it('injects the script only once however many callers ask for it', async () => {
    const { loadAdsenseScript } = await freshLoader();
    const first = loadAdsenseScript();

    expect(loadAdsenseScript()).toBe(first);
    expect(scripts()).toHaveLength(1);
  });

  it('reuses a loader already present in the document', async () => {
    const existing = document.createElement('script');
    existing.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8195080361704709';
    document.head.appendChild(existing);

    const { loadAdsenseScript } = await freshLoader();
    await loadAdsenseScript();

    expect(scripts()).toHaveLength(1);
  });

  it('settles rather than hanging when the script fails to load', async () => {
    const { loadAdsenseScript } = await freshLoader();
    const pending = loadAdsenseScript();
    scripts()[0].dispatchEvent(new Event('error'));

    await expect(pending).resolves.toBeUndefined();
  });
});

describe('isAdEligiblePath', () => {
  it('allows ads on public content pages', async () => {
    const { isAdEligiblePath } = await freshLoader();
    for (const path of ['/', '/blog/how-to-grade', '/events/sydney-show', '/shop', '/prices/pokemon', '/vaulted']) {
      expect(isAdEligiblePath(path), path).toBe(true);
    }
  });

  it('keeps ads off screens without publisher content', async () => {
    const { isAdEligiblePath } = await freshLoader();
    for (const path of ['/login', '/signup/', '/account/orders', '/admin', '/checkout', '/checkout-success', '/vault/add', '/search', '/launch', '/messaging', '/card-shops/add']) {
      expect(isAdEligiblePath(path), path).toBe(false);
    }
  });
});
