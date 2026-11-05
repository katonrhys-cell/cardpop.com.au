import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// The edge-cached public reads (src/routes/public.js): anon-key queries run
// once per TTL, answered with s-maxage so Cloudflare serves the repeats, and
// never cached when a read failed.

const anon = vi.hoisted(() => ({ from: vi.fn() }));
const bundleFn = vi.hoisted(() => vi.fn());
const tickerFn = vi.hoisted(() => vi.fn());
const heroFn = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseAnonClient.js', () => ({ default: anon }));
vi.mock('../../lib/homepageQueries.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, queryHomepageBundle: bundleFn, queryTickerRows: tickerFn, queryShowcaseRows: heroFn };
});

import app from '../../src/app.js';
import { publicReadCache, EDGE_CACHE_CONTROL } from '../../src/routes/public.js';

const okPart = (data) => ({ data, error: null });
const goodBundle = () => ({
  cards: okPart([{ id: 'c1' }]),
  sellers: okPart([{ id: 's1' }]),
  stats: okPart({ sellers: 3, vaultCards: 40, events: 2 }),
  traffic: okPart(null),
});

const facetRows = [{ id: 'p1', sku: 'ZB-04', status: 'active' }];
const facetsQuery = (result) => {
  const chain = { select: vi.fn(() => chain), in: vi.fn(async () => result) };
  anon.from.mockReturnValue(chain);
  return chain;
};

beforeEach(() => {
  publicReadCache.clear();
  bundleFn.mockReset();
  tickerFn.mockReset();
  heroFn.mockReset();
  anon.from.mockReset();
  process.env.PUBLIC_READ_CACHE_TTL_MS = '60000';
});

describe('GET /public/home', () => {
  it('returns the four parts with edge cache headers and runs the queries once per TTL', async () => {
    bundleFn.mockResolvedValue(goodBundle());
    const first = await request(app).get('/public/home');
    expect(first.status).toBe(200);
    expect(first.body.cards.data).toEqual([{ id: 'c1' }]);
    expect(first.body.stats.data.vaultCards).toBe(40);
    expect(first.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
    expect(first.headers.pragma).toBeUndefined();
    expect(first.headers.expires).toBeUndefined();

    const second = await request(app).get('/public/home');
    expect(second.status).toBe(200);
    expect(bundleFn).toHaveBeenCalledTimes(1);
    expect(bundleFn).toHaveBeenCalledWith(anon);
  });

  it('is reachable at the proxied prefix too', async () => {
    bundleFn.mockResolvedValue(goodBundle());
    const res = await request(app).get('/hcgi/api/public/home');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
  });

  it('answers a partial failure uncached so the browser can fall back for that part', async () => {
    const partial = goodBundle();
    partial.traffic = { data: null, error: { message: 'relation missing', code: '42P01' } };
    bundleFn.mockResolvedValue(partial);
    const res = await request(app).get('/public/home');
    expect(res.status).toBe(200);
    expect(res.body.cards.data).toEqual([{ id: 'c1' }]);
    expect(res.body.traffic.error.message).toBe('relation missing');
    expect(res.headers['cache-control']).toBe('no-store');

    // Nothing was cached: the next request runs the queries again.
    bundleFn.mockResolvedValue(goodBundle());
    const again = await request(app).get('/public/home');
    expect(again.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
    expect(bundleFn).toHaveBeenCalledTimes(2);
  });

  it('503s uncached when the queries throw', async () => {
    bundleFn.mockRejectedValue(new Error('network down'));
    const res = await request(app).get('/public/home');
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).not.toContain('network down');
  });

  it('bypasses the micro-cache when its TTL is 0', async () => {
    process.env.PUBLIC_READ_CACHE_TTL_MS = '0';
    bundleFn.mockResolvedValue(goodBundle());
    await request(app).get('/public/home');
    await request(app).get('/public/home');
    expect(bundleFn).toHaveBeenCalledTimes(2);
  });
});

describe('GET /public/shop/facets', () => {
  it('returns the public products facet rows, cached, through the anon client', async () => {
    const chain = facetsQuery({ data: facetRows, error: null });
    const res = await request(app).get('/public/shop/facets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: facetRows, error: null });
    expect(res.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
    expect(anon.from).toHaveBeenCalledWith('shop_products');
    expect(chain.select.mock.calls[0][0]).toMatch(/\bfamily_sku\b/);
    expect(chain.in.mock.calls[0][0]).toBe('status');
    expect(chain.in.mock.calls[0][1]).toEqual(expect.arrayContaining(['active', 'preorder', 'coming_soon']));

    await request(app).get('/public/shop/facets');
    expect(anon.from).toHaveBeenCalledTimes(1);
  });

  it('503s uncached on a query error', async () => {
    facetsQuery({ data: null, error: { message: 'boom' } });
    const res = await request(app).get('/public/shop/facets');
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toBeNull();
  });
});

describe('GET /public/ticker and /public/hero', () => {
  it('serves the ticker rows with edge cache headers, querying once per TTL', async () => {
    tickerFn.mockResolvedValue({ listed: [{ id: 'l1' }], sold: [{ id: 's1' }], error: null });
    const first = await request(app).get('/public/ticker');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
    expect(first.body).toEqual({ listed: [{ id: 'l1' }], sold: [{ id: 's1' }] });
    await request(app).get('/public/ticker');
    expect(tickerFn).toHaveBeenCalledTimes(1);
  });

  it('answers 503 no-store when the ticker read fails, and retries next time', async () => {
    tickerFn.mockResolvedValueOnce({ listed: [], sold: [], error: { message: 'down' } });
    const failed = await request(app).get('/public/ticker');
    expect(failed.status).toBe(503);
    expect(failed.headers['cache-control']).toMatch(/no-store/);
    tickerFn.mockResolvedValueOnce({ listed: [], sold: [], error: null });
    expect((await request(app).get('/public/ticker')).status).toBe(200);
  });

  it('serves the hero rows and never caches a failure', async () => {
    heroFn.mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    const failed = await request(app).get('/public/hero');
    expect(failed.status).toBe(503);
    heroFn.mockResolvedValueOnce({ data: [{ id: 'h1', name: 'Charizard' }], error: null });
    const ok = await request(app).get('/public/hero');
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
    expect(ok.body.cards).toEqual([{ id: 'h1', name: 'Charizard' }]);
  });
});
