import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
const rules = vercel.headers;

// Vercel evaluates every `headers` rule whose source matches, in order, and
// for a repeated key the LAST match sets the value. Two consequences this file
// pins down: (1) the catch-all `/(.*)` rule (max-age=0) must come BEFORE the
// long-cache rules for static files or it silently cancels them, and (2) a
// rule placed before it is dead — exactly what the four duplicated blocks that
// used to open the array were.
const sourceIndex = (source) => rules.findIndex((r) => r.source === source);
const cacheControl = (source) => rules[sourceIndex(source)]?.headers.find((h) => h.key === 'Cache-Control')?.value;
const maxAge = (value) => Number(/max-age=(\d+)/.exec(value || '')?.[1] ?? NaN);

describe('vercel.json headers', () => {
  it('has no duplicate sources (a duplicate before the catch-all is dead weight)', () => {
    const sources = rules.map((r) => r.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('puts the catch-all before every long-cache rule, so those win', () => {
    const catchAll = sourceIndex('/(.*)');
    expect(catchAll).toBeGreaterThan(-1);
    for (const rule of rules) {
      if (maxAge(cacheControl(rule.source)) > 0) {
        expect(sourceIndex(rule.source), `${rule.source} must come after /(.*)`).toBeGreaterThan(catchAll);
      }
    }
  });

  it('serves build output immutable', () => {
    expect(cacheControl('/assets/(.*)')).toContain('immutable');
    expect(cacheControl('/images/(.*)')).toContain('immutable');
    expect(cacheControl('/(.*).woff2')).toContain('immutable');
  });

  // The unhashed public files were served max-age=0, so neither the browser
  // nor Cloudflare kept them: the 207 KB og-image.jpg was fetched by every
  // link unfurl, the PWA icons by every install prompt, robots/llms/openapi by
  // every crawler, straight from Vercel each time.
  it('lets the unhashed public files be cached', () => {
    const covered = (file) => rules.find((r) => new RegExp(`^${r.source}$`).test(file) && maxAge(cacheControl(r.source)) >= 3600);
    for (const file of [
      '/og-image.jpg', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png', '/favicon-192.png',
      '/manifest.json', '/robots.txt', '/llms.txt', '/openapi.json', '/ads.txt',
    ]) {
      expect(covered(file), `${file} has no long-cache rule`).toBeTruthy();
    }
  });

  it('keeps the service worker and HTML fresh', () => {
    // No rule may give sw.js or app.html a positive max-age: a cached shell
    // references deleted chunk hashes after a deploy.
    for (const file of ['/sw.js', '/app.html']) {
      const matching = rules.filter((r) => new RegExp(`^${r.source}$`).test(file));
      const last = matching.at(-1);
      expect(maxAge(cacheControl(last.source))).toBe(0);
    }
  });
});
