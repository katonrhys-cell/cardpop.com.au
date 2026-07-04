import { describe, it, expect, beforeEach, vi } from 'vitest';

// happy-dom doesn't implement Trusted Types, so stub the factory, import the
// module fresh, and exercise the policy rules it registered.
const loadPolicy = async () => {
  let rules;
  window.trustedTypes = {
    createPolicy: vi.fn((name, r) => {
      rules = r;
      return r;
    }),
  };
  vi.resetModules();
  await import('@/lib/trustedTypesPolicy.js');
  return rules;
};

describe('Trusted Types default policy', () => {
  let rules;

  beforeEach(async () => {
    rules = await loadPolicy();
  });

  describe('createScript', () => {
    it('passes JSON-LD payloads through unchanged', () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Trading Card Shows & TCG Events in Australia',
        itemListElement: [],
      });
      expect(rules.createScript(jsonLd)).toBe(jsonLd);
    });

    it('blocks executable code', () => {
      expect(() => rules.createScript('alert(1)')).toThrow(/Blocked eval-like script/);
      expect(() => rules.createScript('window.x = fetch("https://evil.test")')).toThrow(
        /Blocked eval-like script/
      );
    });

    it('blocks near-JSON that only JS accepts', () => {
      expect(() => rules.createScript('{"a": alert(1)}')).toThrow(/Blocked eval-like script/);
      expect(() => rules.createScript('')).toThrow(/Blocked eval-like script/);
    });
  });

  describe('createScriptURL', () => {
    it('allows same-origin, blob and allowlisted hosts', () => {
      expect(rules.createScriptURL('/sw.js')).toBe('/sw.js');
      expect(rules.createScriptURL('blob:null/abc')).toBe('blob:null/abc');
      expect(rules.createScriptURL('https://www.googletagmanager.com/gtag/js')).toBe(
        'https://www.googletagmanager.com/gtag/js'
      );
    });

    it('blocks other origins', () => {
      expect(() => rules.createScriptURL('https://evil.test/x.js')).toThrow(/Blocked script URL/);
    });
  });

  it('sanitizes HTML via DOMPurify', () => {
    const out = rules.createHTML('<img src=x onerror=alert(1)><b>ok</b>');
    expect(out).not.toContain('onerror');
    expect(out).toContain('<b>ok</b>');
  });
});
