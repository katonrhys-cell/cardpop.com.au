import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import sitemapRouter from '../../src/routes/sitemap.js';

function makeApp() {
  const app = express();
  app.use('/', sitemapRouter);
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: [], error: null }) {
  const b = {
    select: vi.fn(() => b), eq: vi.fn(() => b), order: vi.fn(() => b), limit: vi.fn(() => b),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /products', () => {
  it('renders an XML urlset of active product URLs', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({
      data: [{ id: 'p1', updated: '2026-01-01' }, { id: 'p2', updated: '2026-02-01' }],
      error: null,
    }));
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('https://cardpop.com.au/shop/product/p1');
    expect(res.text).toContain('https://cardpop.com.au/shop/product/p2');
    expect(res.text).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>');
  });

  it('renders an empty but valid urlset when there are no products', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null }));
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<urlset');
    expect(res.text).not.toContain('<url>');
  });

  it('returns 500 on a query error', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/products');
    expect(res.status).toBe(500);
    expect(res.text).toMatch(/error generating sitemap/i);
  });
});

describe('GET /listings', () => {
  it('renders vault listing URLs', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [{ id: 'l1', updated: '2026-01-01' }], error: null }));
    const res = await request(app).get('/listings');
    expect(res.status).toBe(200);
    expect(res.text).toContain('https://cardpop.com.au/vault/listing/l1');
  });
});

describe('GET /blog', () => {
  it('prefers the slug for the URL', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({
      data: [{ id: 'b1', slug: 'my-post', updated: '2026-01-01' }], error: null,
    }));
    const res = await request(app).get('/blog');
    expect(res.text).toContain('https://cardpop.com.au/blog/my-post');
  });

  it('falls back to the id when there is no slug', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({
      data: [{ id: 'b2', slug: null, updated: '2026-01-01' }], error: null,
    }));
    const res = await request(app).get('/blog');
    expect(res.text).toContain('https://cardpop.com.au/blog/b2');
  });
});

describe('GET /index', () => {
  it('renders a sitemap index referencing the child sitemaps', async () => {
    const res = await request(app).get('/index');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<sitemapindex');
    expect(res.text).toContain('https://cardpop.com.au/api/sitemap/products');
    expect(res.text).toContain('https://cardpop.com.au/api/sitemap/listings');
    expect(res.text).toContain('https://cardpop.com.au/api/sitemap/blog');
    expect(mockSupabase.from).not.toHaveBeenCalled(); // static, no DB
  });
});
