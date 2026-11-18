import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STATIC_PAGE_SOURCES, sourceKeyFor, staticPageLastmod } from '../../data/sitemapPageSources.js';
import { STATIC_PAGE_DATES } from '../../data/sitemapPageDates.js';
import { ROOT, expandSources, hashSources } from '../../tools/sitemapPageDates.mjs';
import { STATIC_PAGES } from '../../api/sitemap.js';

// A static page's <lastmod> is the day its source files last changed. If this
// fails after you edited a page: run `npm run sitemap:dates` and commit
// data/sitemapPageDates.js.
describe('static sitemap page dates', () => {
  it('every source file exists', () => {
    for (const [key, files] of Object.entries(STATIC_PAGE_SOURCES)) {
      for (const file of files) expect(existsSync(join(ROOT, file)), `${key} → ${file}`).toBe(true);
    }
  });

  it('are regenerated whenever a listed page changes (npm run sitemap:dates)', () => {
    const stale = Object.keys(STATIC_PAGE_SOURCES)
      .filter((key) => STATIC_PAGE_DATES[key]?.hash !== hashSources(STATIC_PAGE_SOURCES[key]));
    expect(stale, 'run `npm run sitemap:dates` and commit data/sitemapPageDates.js').toEqual([]);
    expect(Object.keys(STATIC_PAGE_DATES).sort()).toEqual(Object.keys(STATIC_PAGE_SOURCES).sort());
  });

  it('hold real dates, none in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [key, { lastmod }] of Object.entries(STATIC_PAGE_DATES)) {
      expect(lastmod, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(lastmod <= today, `${key} ${lastmod}`).toBe(true);
    }
  });

  it('every static page in the sitemap is dated from its sources', () => {
    for (const page of STATIC_PAGES) {
      expect(sourceKeyFor(page.loc), `${page.loc} has no entry in data/sitemapPageSources.js`).toBeTruthy();
      expect(page.lastmod, page.loc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('a page takes its own entry before a family, and the longest family', () => {
    const sources = { '/shop': ['a'], '/shop/*': ['b'], '/shop/binders/*': ['c'] };
    expect(sourceKeyFor('/shop', sources)).toBe('/shop');
    expect(sourceKeyFor('/shop/top-loaders/x', sources)).toBe('/shop/*');
    expect(sourceKeyFor('/shop/binders/x', sources)).toBe('/shop/binders/*');
    expect(sourceKeyFor('/elsewhere', sources)).toBeNull();
    expect(staticPageLastmod('/shop/binders/x', { '/shop/binders/*': { lastmod: '2026-01-02' } }, sources)).toBe('2026-01-02');
  });

  it("adds a page's direct data, config and policy imports to its sources", () => {
    const files = expandSources(['pages/info/ReturnsPage.jsx']);
    expect(files).toContain('utils/buyerProtectionPolicy.js');
    expect(files).toContain('utils/shopReturnPolicy.js');
    expect(expandSources(['pages/info/TermsPage.jsx'])).toContain('data/termsOfService.js');
  });
});
