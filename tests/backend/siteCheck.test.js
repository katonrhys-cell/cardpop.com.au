import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runSiteCheck, pickPaths, invokeHandler, PRODUCT_SECTIONS } from '../../src/utils/siteCheck.js';
import { REQUIRED_PAGES } from '../../src/utils/sitemapCheck.js';

const BASE = 'https://cardpop.com.au';
const root = new URL('../../', import.meta.url);
const realFiles = {
  'vercel.json': readFileSync(new URL('vercel.json', root), 'utf8'),
  'public/robots.txt': readFileSync(new URL('public/robots.txt', root), 'utf8'),
};

// A sitemap that satisfies the floors: the core pages, one page per required
// section, and filler events.
const PATHS = [
  ...REQUIRED_PAGES,
  // One real-shaped page per required section (the bot rewrites are specific).
  '/events/one', '/shop/protection', '/blog/one', '/prices/pokemon', '/card-shops/melbourne',
  '/shop/top-loaders/some-line', '/marketplace/abc/charizard', '/about',
  ...Array.from({ length: 200 }, (_, i) => `/events/show-${i}`),
];
const sitemapXml = (paths = PATHS) => [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...paths.map((p) => `  <url>\n    <loc>${BASE}${p}</loc>\n    <lastmod>2026-11-01</lastmod>\n  </url>`),
  '</urlset>',
].join('\n');

const product = (extra = '"brand":{"@type":"Brand","name":"CardPop"}') =>
  `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Thing",${extra}}</script>`;
const page = (path, { head = '', robots = 'index, follow', canonical = `${BASE}${path}` } = {}) =>
  `<!doctype html><html><head><meta name="robots" content="${robots}"><link rel="canonical" href="${canonical}">${head}</head><body></body></html>`;

const deps = (overrides = {}) => ({
  sitemap: async (req, res) => res.status(200).send(sitemapXml(overrides.paths)),
  prerender: async (req, res) => {
    const path = String(req.query.path || '/');
    const custom = overrides.pages?.[path];
    if (custom) return custom(req, res);
    const isProduct = PRODUCT_SECTIONS.some((s) => path.startsWith(s));
    return res.status(200).send(page(path, { head: isProduct ? product() : '' }));
  },
  readText: async (file) => {
    if (overrides.files && file in overrides.files) {
      if (overrides.files[file] instanceof Error) throw overrides.files[file];
      return overrides.files[file];
    }
    return realFiles[file];
  },
});

describe('daily site check', () => {
  it('passes a healthy site, through the real bot rewrites in vercel.json', async () => {
    const report = await runSiteCheck({}, deps());
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.urls).toBe(PATHS.length);
    expect(report.pages).toBeGreaterThan(10);
    expect(report.products).toBeGreaterThan(0);
  });

  it('reports a listed page that is noindex, missing, redirected or names another canonical', async () => {
    const report = await runSiteCheck({}, deps({
      pages: {
        '/terms': (req, res) => res.status(200).send(page('/terms', { robots: 'noindex, follow' })),
        '/blog': (req, res) => res.status(404).send('gone'),
        '/shop': (req, res) => { res.setHeader('Location', '/store'); return res.status(301).send(''); },
        '/about': (req, res) => res.status(200).send(page('/about', { canonical: `${BASE}/` })),
      },
    }));
    expect(report.ok).toBe(false);
    const text = report.problems.join('\n');
    expect(text).toContain(`${BASE}/terms is in the sitemap but is noindex`);
    expect(text).toContain(`${BASE}/blog is in the sitemap but answers HTTP 404`);
    expect(text).toContain(`${BASE}/shop is in the sitemap but redirects (HTTP 301) to /store`);
    expect(text).toContain(`${BASE}/about is in the sitemap but names another canonical: ${BASE}/`);
  });

  it('reports a Product with no global identifier', async () => {
    const report = await runSiteCheck({}, deps({
      pages: {
        '/marketplace/abc/charizard': (req, res) => res.status(200)
          .send(page('/marketplace/abc/charizard', { head: product('"sku":"X"') })),
      },
    }));
    expect(report.problems).toEqual([
      `${BASE}/marketplace/abc/charizard Product markup — Thing: no global identifier (brand / mpn / gtin)`,
    ]);
  });

  it('reports a listed page no bot rewrite sends to the prerender', async () => {
    const report = await runSiteCheck({}, deps({ paths: [...PATHS, '/account/orders'] }));
    const text = report.problems.join('\n');
    expect(text).toContain(`${BASE}/account/orders is in the sitemap but disallowed by robots.txt`);
    expect(text).toContain(`${BASE}/account/orders is in the sitemap but no bot rewrite sends it to the prerender`);
  });

  it('reports an emptied section and a sitemap that fails to generate', async () => {
    const noEvents = await runSiteCheck({}, deps({ paths: PATHS.filter((p) => !p.startsWith('/events/')) }));
    expect(noEvents.problems.join('\n')).toMatch(/no \/events\/… pages are listed/);

    const broken = await runSiteCheck({}, { ...deps(), sitemap: async () => { throw new Error('boom'); } });
    expect(broken.ok).toBe(false);
    expect(broken.problems.join('\n')).toContain('sitemap.xml could not be generated: boom');
  });

  it('says so when its bundled files are missing, rather than passing', async () => {
    const report = await runSiteCheck({}, deps({
      files: { 'vercel.json': Object.assign(new Error('nope'), { code: 'ENOENT' }) },
    }));
    expect(report.ok).toBe(false);
    expect(report.problems.join('\n')).toContain('vercel.json could not be read by the check (ENOENT)');
    expect(report.pages).toBe(0);
  });

  it('samples the product sections more deeply than the rest', () => {
    const paths = [
      '/', ...Array.from({ length: 60 }, (_, i) => `/events/e${i}`),
      ...Array.from({ length: 60 }, (_, i) => `/shop/cat/p${i}`),
    ];
    const picked = pickPaths(paths, { sample: 2, productSample: 6 });
    const count = (prefix) => picked.filter((p) => p.startsWith(prefix)).length;
    expect(count('/shop/')).toBeGreaterThan(count('/events/'));
    expect(picked).toContain('/');
  });

  it('captures status, headers and body from a handler', async () => {
    const out = await invokeHandler(async (req, res) => {
      res.setHeader('X-Robots-Tag', 'noindex');
      return res.status(410).json({ gone: req.query.path });
    }, { query: { path: '/x' } });
    expect(out).toEqual({ status: 410, headers: { 'x-robots-tag': 'noindex' }, body: '{"gone":"/x"}' });
  });
});

describe('site check function', () => {
  it('is wired: its own function with the files it reads bundled, a /cron rewrite, and fail-closed auth', async () => {
    const vercel = JSON.parse(realFiles['vercel.json']);
    const fn = vercel.functions['api/site-check.js'];
    expect(fn.maxDuration).toBeGreaterThanOrEqual(60);
    expect(fn.includeFiles).toContain('vercel.json');
    expect(fn.includeFiles).toContain('public/robots.txt');
    expect(vercel.rewrites).toContainEqual({ source: '/cron/site-check', destination: '/api/site-check' });

    const { default: handler } = await import('../../api/site-check.js');
    const saved = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      expect((await invokeHandler(handler, { headers: { authorization: 'Bearer x' } })).status).toBe(401);
      process.env.CRON_SECRET = 'right';
      expect((await invokeHandler(handler, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
      expect((await invokeHandler(handler, { headers: {} })).status).toBe(401);
    } finally {
      if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
    }
  });
});
