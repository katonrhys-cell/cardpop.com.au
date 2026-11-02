import { describe, it, expect } from 'vitest';
import {
  loadRoutingConfig, compileRouting, hasValueRegExp, substituteParams, resolveDestination,
  matchRedirect, resolveRewrite, headersFor, isSpaFallback,
} from '../../server/vercelRoutes.js';

const routing = loadRoutingConfig();
const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const HUMAN = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

const facts = (pathname, { ua = HUMAN, host = 'cardpop.com.au', query = {} } = {}) => ({
  pathname, host, headers: { 'user-agent': ua }, query, cookies: {},
});

// The functions api/*.js and the two HTML entries — what a rewrite chain can end on.
const FUNCTIONS = new Set(['/api/index', '/api/prerender', '/api/sitemap', '/api/merchant-feed', '/api/blog-generate', '/api/event-scan', '/api/grade-estimate', '/app.html', '/index.html']);
const isTerminal = (p) => FUNCTIONS.has(p);
const rewrite = (pathname, opts) => resolveRewrite(routing, facts(pathname, opts), { isTerminal });

describe('vercel.json compiles', () => {
  it('compiles every redirect, rewrite and header source', () => {
    expect(routing.redirects.length).toBeGreaterThan(0);
    expect(routing.rewrites.length).toBeGreaterThan(0);
    expect(routing.headers.length).toBeGreaterThan(0);
    for (const rule of [...routing.redirects, ...routing.rewrites, ...routing.headers]) {
      expect(typeof rule.matcher).toBe('function');
    }
  });

  it('rejects a has.type it does not understand', () => {
    expect(() => compileRouting({ rewrites: [{ source: '/x', destination: '/y', has: [{ type: 'moon', key: 'k' }] }] }))
      .toThrow(/unsupported has.type/);
  });
});

describe('hasValueRegExp', () => {
  it('lifts (?i) into the i flag and anchors the match', () => {
    const re = hasValueRegExp('(?i).*(googlebot|bingbot).*');
    expect(re.flags).toBe('i');
    expect(re.test('Mozilla GOOGLEBOT/2.1')).toBe(true);
    expect(re.test('Mozilla/5.0 Chrome')).toBe(false);
    expect(hasValueRegExp('abc').test('xabcx')).toBe(false);
  });
});

describe('substituteParams', () => {
  it('fills single and repeated params', () => {
    expect(substituteParams('/marketplace/:id/:slug*', { id: '42', slug: ['a', 'b'] })).toBe('/marketplace/42/a/b');
    expect(substituteParams('/api/:path*', { path: ['stripe', 'webhook'] })).toBe('/api/stripe/webhook');
  });
  it('drops the slash before an absent optional param', () => {
    expect(substituteParams('/marketplace/:id/:slug*', { id: '42' })).toBe('/marketplace/42');
    expect(substituteParams('https://cardpop.com.au/:path*', {})).toBe('https://cardpop.com.au/');
    expect(substituteParams('/:path*', {})).toBe('/');
  });
  it('splits a destination query and fills it too', () => {
    expect(resolveDestination('/api/prerender?path=/blog/:slug', { slug: 'hello' }))
      .toEqual({ pathname: '/api/prerender', query: { path: '/blog/hello' } });
    expect(resolveDestination('/api/prerender?path=/prices/:path*', { path: ['pokemon', 'charizard'] }).query.path)
      .toBe('/prices/pokemon/charizard');
  });
});

describe('redirects', () => {
  it('sends www to the apex host, keeping path and query, with a 308', () => {
    const r = matchRedirect(routing, facts('/shop/binders', { host: 'www.cardpop.com.au', query: { colour: 'red' } }));
    expect(r).toEqual(expect.objectContaining({ status: 308, location: 'https://cardpop.com.au/shop/binders?colour=red' }));
    expect(matchRedirect(routing, facts('/', { host: 'www.cardpop.com.au' })).location).toBe('https://cardpop.com.au/');
  });
  it('does not redirect the apex host', () => {
    expect(matchRedirect(routing, facts('/shop/binders'))).toBeNull();
    expect(matchRedirect(routing, facts('/'))).toBeNull();
  });
  it('moves the legacy marketplace and community paths', () => {
    expect(matchRedirect(routing, facts('/product/marketplace/abc/some-card')).location).toBe('/marketplace/abc/some-card');
    expect(matchRedirect(routing, facts('/product/marketplace/abc')).location).toBe('/marketplace/abc');
    expect(matchRedirect(routing, facts('/community/events')).location).toBe('/events');
    expect(matchRedirect(routing, facts('/community/events/sydney-show')).location).toBe('/events/sydney-show');
  });
});

describe('rewrites', () => {
  it('maps the proxy prefix onto the API function, chaining through /api/:path*', () => {
    const r = rewrite('/hcgi/api/stripe/webhook');
    expect(r.pathname).toBe('/api/index');
    expect(r.matched).toEqual(['/hcgi/api/:path*', '/api/:path*']);
    expect(rewrite('/api/health').pathname).toBe('/api/index');
  });

  it('serves the sitemap, feed, cron and grade-estimate functions', () => {
    expect(rewrite('/sitemap.xml').pathname).toBe('/api/sitemap');
    expect(rewrite('/merchant-feed.tsv').pathname).toBe('/api/merchant-feed');
    expect(rewrite('/cron/blog-generate').pathname).toBe('/api/blog-generate');
    expect(rewrite('/cron/event-scan', { query: { mode: 'watches' } })).toEqual(expect.objectContaining({ pathname: '/api/event-scan', query: { mode: 'watches' } }));
    expect(rewrite('/grade-estimate/estimate').pathname).toBe('/api/grade-estimate');
  });

  it('prerenders public pages for bots only, passing the path through', () => {
    for (const [p, expected] of [
      ['/', '/'],
      ['/shop', '/shop'],
      ['/shop/binders/9-pocket-zip-binder', '/shop/binders/9-pocket-zip-binder'],
      ['/shop/graded-card-protectors/metal-slab-case', '/shop/graded-card-protectors/metal-slab-case'],
      ['/blog/some-article', '/blog/some-article'],
      ['/blog/category/news', '/blog/category/news'],
      ['/events/sydney-card-show', '/events/sydney-card-show'],
      ['/community/forum', '/community/forum'],
      ['/about', '/about'],
      ['/grading/scales', '/grading/scales'],
      ['/prices/pokemon/charizard', '/prices/pokemon/charizard'],
      ['/players/some-player', '/players/some-player'],
      ['/marketplace/abc/card-slug', '/marketplace/abc/card-slug'],
    ]) {
      const r = rewrite(p, { ua: BOT });
      expect(r.pathname, p).toBe('/api/prerender');
      expect(r.query.path, p).toBe(expected);
    }
  });

  it('keeps the request query alongside the prerender path', () => {
    const r = rewrite('/shop/binders/9-pocket-zip-binder', { ua: BOT, query: { colour: 'red' } });
    expect(r.query).toEqual({ colour: 'red', path: '/shop/binders/9-pocket-zip-binder' });
  });

  it('does not prerender for a browser, or a page outside the list, or Lighthouse on /', () => {
    expect(rewrite('/shop', { ua: HUMAN }).matched).toEqual(['/((?!images/|assets/).*)']);
    expect(rewrite('/account/orders', { ua: BOT }).pathname).toBe('/app.html');
    expect(rewrite('/', { ua: 'Mozilla/5.0 Chrome-Lighthouse' }).matched).not.toContain('/');
    expect(rewrite('/shop', { ua: 'Mozilla/5.0 Chrome-Lighthouse' }).pathname).toBe('/api/prerender');
  });

  it('never rewrites a missing asset or image onto the shell', () => {
    expect(rewrite('/assets/index-deadbeef.js').matched).toEqual([]);
    expect(rewrite('/images/shop/x.jpg').matched).toEqual([]);
  });

  it('can hold the SPA fallback back for the static-file pass', () => {
    const r = resolveRewrite(routing, facts('/robots.txt'), { isTerminal, skip: isSpaFallback });
    expect(r.matched).toEqual([]);
    expect(routing.rewrites.filter(isSpaFallback)).toHaveLength(1);
  });
});

describe('headers', () => {
  const header = (pathname, key) => headersFor(routing, facts(pathname)).filter(([k]) => k === key).at(-1)?.[1];

  it('gives HTML the CSP and a zero max-age, and hashed assets a year', () => {
    expect(header('/shop/binders', 'Content-Security-Policy')).toMatch(/strict-dynamic/);
    expect(header('/shop/binders', 'Cache-Control')).toBe('public, max-age=0, must-revalidate');
    expect(header('/assets/index-abc.js', 'Cache-Control')).toContain('immutable');
    expect(header('/fonts/syne-latin-var.woff2', 'Cache-Control')).toContain('immutable');
    expect(header('/fonts/syne-latin-var.woff2', 'Content-Type')).toBe('font/woff2');
    expect(header('/og-image.jpg', 'Cache-Control')).toContain('max-age=604800');
    expect(header('/robots.txt', 'Cache-Control')).toContain('max-age=3600');
  });

  it('adds the font preload Link on the homepage only', () => {
    expect(header('/', 'Link')).toMatch(/rel="preload"/);
    expect(header('/shop', 'Link')).toBeUndefined();
  });

  it('types the .well-known documents', () => {
    expect(header('/.well-known/api-catalog', 'Content-Type')).toBe('application/linkset+json; charset=utf-8');
    expect(header('/.well-known/agent-skills/listing/SKILL.md', 'Content-Type')).toBe('text/markdown; charset=utf-8');
  });

  it('marks API responses uncacheable', () => {
    expect(header('/api/health', 'Cache-Control')).toBe('no-cache, no-store, must-revalidate');
  });
});
