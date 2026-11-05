import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { publicCache } from '../../src/middleware/publicCache.js';
import { noCacheHeaders } from '../../src/middleware/secureHeaders.js';

// Visitor-independent GETs opt in to browser + CDN caching; errors and
// degraded fallbacks keep the API-wide no-store.

function makeApp() {
  const app = express();
  app.use(noCacheHeaders);
  const cache = publicCache({ browser: 10, edge: 20, swr: 30 });
  app.get('/ok', cache, (_req, res) => res.json({ ok: true }));
  app.get('/fail', cache, (_req, res) => res.status(502).json({ error: 'upstream' }));
  app.get('/fallback', cache, (_req, res) => {
    res.locals.uncacheable = true;
    res.json({ results: [] });
  });
  return app;
}
const app = makeApp();

describe('publicCache', () => {
  it('marks a successful answer public with browser and edge lifetimes', async () => {
    const res = await request(app).get('/ok');
    expect(res.headers['cache-control']).toBe('public, max-age=10, s-maxage=20, stale-while-revalidate=30');
    expect(res.headers.pragma).toBeUndefined();
    expect(res.headers.expires).toBeUndefined();
  });

  it('leaves an error response no-store', async () => {
    const res = await request(app).get('/fail');
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });

  it('leaves a degraded fallback no-store when the handler says so', async () => {
    const res = await request(app).get('/fallback');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });
});
