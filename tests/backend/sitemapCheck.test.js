import { describe, it, expect } from 'vitest';
import {
  parseSitemap, checkSitemap, checkRobots, robotsRules, robotsAllows, checkListedPage, samplePaths,
} from '../../src/utils/sitemapCheck.js';

const BASE = 'https://cardpop.com.au';
const url = (path, lastmod = '2026-11-01') => `  <url>\n    <loc>${BASE}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
const doc = (...urls) => [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '  <!-- Core & static pages -->',
  ...urls,
  '</urlset>',
].join('\n');
const opts = { today: '2026-11-18', minUrls: 1, requiredSections: [], requiredPages: [] };

describe('sitemap check — the file', () => {
  it('passes a well-formed sitemap (an & inside a comment is legal)', () => {
    const { urls, problems } = checkSitemap(doc(url('/'), url('/shop')), opts);
    expect(urls).toHaveLength(2);
    expect(problems).toEqual([]);
  });

  it('reports a truncated file and an unescaped &', () => {
    const cut = doc(url('/')).replace('</urlset>', '');
    expect(parseSitemap(cut).problems.join(' ')).toMatch(/does not end with <\/urlset>/);
    const amp = doc(url('/events/cards-&-comics'));
    expect(parseSitemap(amp).problems.join(' ')).toMatch(/unescaped &/);
    expect(parseSitemap(doc(url('/events/cards-&amp;-comics'))).problems).toEqual([]);
  });

  it('reports duplicates, foreign hosts, query strings and bad dates', () => {
    const { problems } = checkSitemap(doc(
      url('/shop'), url('/shop'),
      '  <url>\n    <loc>https://example.com/x</loc>\n    <lastmod>2026-11-01</lastmod>\n  </url>',
      url('/search?q=x'), url('/blog/', '2026-11-01'), url('/a', 'yesterday'), url('/b', '2027-01-01'),
    ), opts);
    const text = problems.join('\n');
    expect(text).toMatch(/\/shop is listed twice/);
    expect(text).toMatch(/example\.com\/x is not on/);
    expect(text).toMatch(/query string/);
    expect(text).toMatch(/ends with a slash/);
    expect(text).toMatch(/invalid lastmod "yesterday"/);
    expect(text).toMatch(/lastmod in the future/);
  });

  it('reports an emptied section, a missing core page and a collapsed file', () => {
    const { problems } = checkSitemap(doc(url('/'), url('/shop/x')), {
      today: '2026-11-18', minUrls: 5, requiredSections: ['/shop/', '/events/'], requiredPages: ['/', '/terms'],
    });
    expect(problems).toEqual([
      'sitemap.xml lists 2 URLs — fewer than the floor of 5',
      `${BASE}/terms is missing from the sitemap`,
      "no /events/… pages are listed — that section's query probably failed",
    ]);
  });
});

describe('sitemap check — robots.txt', () => {
  const robots = [
    'User-agent: *', 'Allow: /', 'Disallow: /account', 'Disallow: /vault', 'Allow: /vault/public',
    '', 'User-agent: GPTBot', 'Disallow: /shop', '', `Sitemap: ${BASE}/sitemap.xml`,
  ].join('\n');

  it('reads only the rules for every crawler, longest match winning', () => {
    const rules = robotsRules(robots);
    expect(robotsAllows(rules, '/shop/x')).toBe(true);
    expect(robotsAllows(rules, '/account/orders')).toBe(false);
    expect(robotsAllows(rules, '/vault/public/1')).toBe(true);
  });

  it('reports a listed page robots.txt blocks, and a missing Sitemap line', () => {
    expect(checkRobots(robots, ['/shop', '/blog'])).toEqual([]);
    expect(checkRobots(robots, ['/account/x']).join(' ')).toMatch(/disallowed by robots\.txt/);
    expect(checkRobots('User-agent: *\nAllow: /', ['/']).join(' ')).toMatch(/has no "Sitemap:/);
  });

  it("the site's own robots.txt advertises the sitemap", async () => {
    const { readFileSync } = await import('node:fs');
    const live = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
    expect(checkRobots(live, ['/', '/shop', '/events/x', '/blog/y', '/prices/pokemon/z', '/card-shops/melbourne'])).toEqual([]);
  });
});

describe('sitemap check — a listed page', () => {
  const page = (head) => `<!doctype html><html><head>${head}</head><body></body></html>`;
  const loc = `${BASE}/terms`;

  it('passes an indexable page that names itself', () => {
    expect(checkListedPage(page(`<meta name="robots" content="index, follow"><link rel="canonical" href="${loc}">`), loc)).toEqual([]);
  });

  it('reports noindex, in the markup or the header', () => {
    expect(checkListedPage(page(`<meta name="robots" content="noindex, follow"><link rel="canonical" href="${loc}">`), loc)).toEqual(['is noindex']);
    expect(checkListedPage(page(`<link rel="canonical" href="${loc}">`), loc, { xRobotsTag: 'noindex' })).toEqual(['is noindex']);
  });

  it('reports a missing or different canonical', () => {
    expect(checkListedPage(page(''), loc)).toEqual(['has no canonical link']);
    expect(checkListedPage(page(`<link rel="canonical" href="${BASE}/">`), loc)).toEqual([`names another canonical: ${BASE}/`]);
  });
});

describe('sitemap check — sampling', () => {
  it('takes a spread from every section and always the core pages', () => {
    const paths = ['/', '/terms', ...Array.from({ length: 40 }, (_, i) => `/events/e${i}`), '/blog/a', '/blog/b'];
    const picked = samplePaths(paths, 3, ['/', '/terms']);
    expect(picked).toContain('/');
    expect(picked).toContain('/terms');
    expect(picked).toContain('/events/e0');
    expect(picked).toContain('/events/e39');
    expect(picked).toContain('/blog/a');
    expect(picked.length).toBeLessThan(12);
  });
});
