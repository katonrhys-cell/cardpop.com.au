import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, FUNCTION_MODULES, distIsBuilt } from '../../server/app.js';

// The self-hosted server (server/app.js) with a throwaway dist/ and stub
// functions, so these tests exercise the routing — redirects, headers,
// static files, rewrites into the right function, the SPA fallback — without
// importing the prerenderer or the API.

const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1)';
const HUMAN = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0';

let distDir;
const calls = [];

const stubHandler = (name) => async (req, res) => {
  calls.push({ name, url: req.url, query: { ...req.query } });
  res.status(200).type('text/plain').send(`${name} ok`);
};
const apiApp = express();
apiApp.get('/api/health', (req, res) => res.json({ status: 'ok', via: 'api' }));
apiApp.get('/hcgi/api/health', (req, res) => res.json({ status: 'ok', via: 'hcgi' }));
apiApp.use((req, res) => res.status(404).json({ error: 'Route not found' }));
const gradeApp = express();
gradeApp.get('/grade-estimate/estimate', (req, res) => res.json({ grade: 'app' }));

const functions = {
  '/api/index': { kind: 'app', fn: apiApp },
  '/api/grade-estimate': { kind: 'app', fn: gradeApp },
  '/api/prerender': { kind: 'handler', fn: stubHandler('prerender') },
  '/api/sitemap': { kind: 'handler', fn: stubHandler('sitemap') },
  '/api/merchant-feed': { kind: 'handler', fn: stubHandler('merchant-feed') },
  '/api/blog-generate': { kind: 'handler', fn: stubHandler('blog-generate') },
  '/api/event-scan': { kind: 'handler', fn: stubHandler('event-scan') },
};
const loadFunction = vi.fn(async (name) => {
  if (!functions[name]) throw new Error(`no stub for ${name}`);
  return functions[name];
});

let app;

beforeAll(() => {
  distDir = mkdtempSync(path.join(tmpdir(), 'cardpop-dist-'));
  mkdirSync(path.join(distDir, 'assets'));
  mkdirSync(path.join(distDir, 'images'));
  mkdirSync(path.join(distDir, 'fonts'));
  mkdirSync(path.join(distDir, '.well-known'), { recursive: true });
  writeFileSync(path.join(distDir, 'index.html'), '<!DOCTYPE html><html><body>HOME SHELL</body></html>');
  writeFileSync(path.join(distDir, 'app.html'), '<!DOCTYPE html><html><body>APP SHELL</body></html>');
  writeFileSync(path.join(distDir, 'robots.txt'), 'User-agent: *\n');
  writeFileSync(path.join(distDir, 'sw.js'), '// sw');
  writeFileSync(path.join(distDir, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(distDir, 'images', 'hero.jpg'), 'jpg');
  writeFileSync(path.join(distDir, 'fonts', 'syne.woff2'), 'woff');
  writeFileSync(path.join(distDir, '.well-known', 'api-catalog'), '{}');
  writeFileSync(path.join(distDir, '.well-known', 'security.txt'), 'Contact: x');
  app = createServer({ distDir, loadFunction });
});

afterAll(() => {
  rmSync(distDir, { recursive: true, force: true });
});

describe('function table', () => {
  it('names every api/*.js function Vercel deployed', () => {
    expect(Object.keys(FUNCTION_MODULES).sort()).toEqual([
      '/api/blog-generate', '/api/event-scan', '/api/grade-estimate', '/api/index',
      '/api/merchant-feed', '/api/prerender', '/api/sitemap',
    ]);
  });
  it('knows when the build is missing', () => {
    expect(distIsBuilt(distDir)).toBe(true);
    expect(distIsBuilt(path.join(distDir, 'nope'))).toBe(false);
  });
});

describe('redirects', () => {
  it('308s www to the apex host with the path and query', async () => {
    const res = await request(app).get('/shop/binders?colour=red').set('Host', 'www.cardpop.com.au');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://cardpop.com.au/shop/binders?colour=red');
  });
  it('moves legacy paths', async () => {
    const res = await request(app).get('/product/marketplace/abc/card-name');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('/marketplace/abc/card-name');
  });
});

describe('HTML entries', () => {
  it('serves the hero shell for "/" to a browser, with the homepage headers', async () => {
    const res = await request(app).get('/').set('User-Agent', HUMAN);
    expect(res.status).toBe(200);
    expect(res.text).toContain('HOME SHELL');
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
    expect(res.headers['content-security-policy']).toMatch(/strict-dynamic/);
    expect(res.headers.link).toMatch(/rel="preload"/);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves the app shell for every client route, without the homepage Link', async () => {
    for (const route of ['/shop', '/shop/', '/account/orders', '/marketplace/abc/slug', '/admin/products', '/some/deep/route']) {
      const res = await request(app).get(route).set('User-Agent', HUMAN);
      expect(res.status, route).toBe(200);
      expect(res.text, route).toContain('APP SHELL');
      expect(res.headers.link, route).toBeUndefined();
      expect(res.headers['cache-control'], route).toBe('public, max-age=0, must-revalidate');
    }
  });

  it('answers HEAD for the shell and refuses other methods on it', async () => {
    expect((await request(app).head('/').set('User-Agent', HUMAN)).status).toBe(200);
    expect((await request(app).post('/shop').set('User-Agent', HUMAN)).status).toBe(404);
  });
});

describe('static files', () => {
  it('serves build files with the manifest cache headers', async () => {
    const asset = await request(app).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(asset.headers['x-content-type-options']).toBe('nosniff');

    const font = await request(app).get('/fonts/syne.woff2');
    expect(font.headers['cache-control']).toContain('immutable');
    expect(font.headers['content-type']).toBe('font/woff2');

    const robots = await request(app).get('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');

    const sw = await request(app).get('/sw.js');
    expect(sw.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
  });

  it('serves the dot-directory documents with their declared types', async () => {
    const catalog = await request(app).get('/.well-known/api-catalog');
    expect(catalog.status).toBe(200);
    expect(catalog.headers['content-type']).toBe('application/linkset+json; charset=utf-8');
    const sec = await request(app).get('/.well-known/security.txt');
    expect(sec.status).toBe(200);
    expect(sec.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('404s a missing asset or image instead of handing back the shell', async () => {
    for (const p of ['/assets/missing.js', '/images/missing.jpg']) {
      const res = await request(app).get(p).set('User-Agent', HUMAN);
      expect(res.status, p).toBe(404);
      expect(res.text, p).not.toContain('SHELL');
    }
  });
});

describe('functions', () => {
  it('routes /api and /hcgi/api to the API app with the original url', async () => {
    const api = await request(app).get('/api/health');
    expect(api.status).toBe(200);
    expect(api.body).toEqual({ status: 'ok', via: 'api' });
    const proxied = await request(app).get('/hcgi/api/health');
    expect(proxied.body).toEqual({ status: 'ok', via: 'hcgi' });
    const unknown = await request(app).get('/api/nope');
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Route not found' });
  });

  it('does not expose the API at the bare root', async () => {
    const res = await request(app).get('/health').set('User-Agent', HUMAN);
    expect(res.text).toContain('APP SHELL');
  });

  it('serves the sitemap, feed and cron functions by their public paths', async () => {
    calls.length = 0;
    expect((await request(app).get('/sitemap.xml')).text).toBe('sitemap ok');
    expect((await request(app).get('/merchant-feed.tsv')).text).toBe('merchant-feed ok');
    expect((await request(app).get('/cron/blog-generate')).text).toBe('blog-generate ok');
    expect((await request(app).get('/cron/event-scan?mode=watches&event=abc')).text).toBe('event-scan ok');
    expect(calls.at(-1).query).toEqual({ mode: 'watches', event: 'abc' });
    expect((await request(app).get('/grade-estimate/estimate')).body).toEqual({ grade: 'app' });
  });

  it('prerenders listed pages for bots, passing the path and the request query', async () => {
    calls.length = 0;
    const home = await request(app).get('/').set('User-Agent', BOT);
    expect(home.text).toBe('prerender ok');
    expect(calls.at(-1).query).toEqual({ path: '/' });

    await request(app).get('/shop/binders/9-pocket-zip-binder?colour=red').set('User-Agent', BOT);
    expect(calls.at(-1).query).toEqual({ colour: 'red', path: '/shop/binders/9-pocket-zip-binder' });

    await request(app).get('/prices/pokemon/charizard').set('User-Agent', BOT);
    expect(calls.at(-1).query.path).toBe('/prices/pokemon/charizard');
  });

  it('gives bots the shell for pages that are not prerendered, and humans the shell for everything', async () => {
    const acc = await request(app).get('/account/orders').set('User-Agent', BOT);
    expect(acc.text).toContain('APP SHELL');
    const shop = await request(app).get('/shop').set('User-Agent', HUMAN);
    expect(shop.text).toContain('APP SHELL');
  });

  it('turns a function error into a 500 without leaking it', async () => {
    const broken = createServer({
      distDir,
      loadFunction: async () => ({ kind: 'handler', fn: async () => { throw new Error('boom secret'); } }),
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(broken).get('/sitemap.xml');
    errSpy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('secret');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('liveness', () => {
  it('answers /healthz without loading any function', async () => {
    const before = loadFunction.mock.calls.length;
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', dist: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(loadFunction.mock.calls.length).toBe(before);
  });
});
