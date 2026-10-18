import { vi, describe, it, expect, beforeEach } from 'vitest';

// Each table's rows come from state.tables; paged queries are sliced by the
// .range() they ask for, so the test can see whether paging walks past 1,000.
const state = vi.hoisted(() => ({ tables: {}, ranges: {} }));

vi.mock('@supabase/supabase-js', () => {
  const builder = (table) => {
    let range = null;
    const b = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'not', 'or', 'order', 'limit', 'ilike']) {
      b[m] = vi.fn(() => b);
    }
    b.range = vi.fn((from, to) => {
      range = [from, to];
      (state.ranges[table] ||= []).push(range);
      return b;
    });
    b.then = (resolve, reject) => {
      const rows = state.tables[table] || [];
      const data = range ? rows.slice(range[0], range[1] + 1) : rows;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return b;
  };
  return { createClient: vi.fn(() => ({ from: vi.fn((table) => builder(table)) })) };
});

import handler from '../../api/sitemap.js';

function run() {
  let body = '';
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { body = payload; return this; },
  };
  return handler({ query: {} }, res).then(() => ({ status: res.statusCode, body }));
}

const loc = (path) => `<loc>https://cardpop.com.au${path}</loc>`;

beforeEach(() => { state.tables = {}; state.ranges = {}; });

describe('sitemap shop category pages', () => {
  it('lists categories that have products, with the newest product as lastmod', async () => {
    state.tables.shop_products = [
      { id: 'p1', title: 'Penny Sleeves 100', slug: 'penny-sleeves-100', category: 'Penny Sleeves', updated_at: '2026-09-01T00:00:00Z' },
      { id: 'p2', title: 'Penny Sleeves 500', slug: 'penny-sleeves-500', category: 'Penny Sleeves', updated_at: '2026-09-20T00:00:00Z' },
    ];
    const { status, body } = await run();
    expect(status).toBe(200);
    expect(body).toContain(`${loc('/shop/category/penny-sleeves')}\n    <lastmod>2026-09-20</lastmod>`);
    // No products → not advertised.
    expect(body).not.toContain(loc('/shop/category/top-loaders'));
  });

  it('includes admin-added categories and drops hidden ones', async () => {
    state.tables.shop_categories = [
      { section_slug: 'storage', name: 'Card Tins', hidden: false },
      { section_slug: 'protection', name: 'Penny Sleeves', hidden: true },
    ];
    state.tables.shop_products = [
      { id: 'p1', title: 'Card Tin', slug: 'card-tin', category: 'Card Tins', updated_at: '2026-09-01T00:00:00Z' },
      { id: 'p2', title: 'Penny Sleeves 100', slug: 'penny-sleeves-100', category: 'Penny Sleeves', updated_at: '2026-09-01T00:00:00Z' },
    ];
    const { body } = await run();
    expect(body).toContain(loc('/shop/category/card-tins'));
    expect(body).not.toContain(loc('/shop/category/penny-sleeves'));
  });
});

describe('sitemap paging', () => {
  it('pages past the 1,000-row response cap', async () => {
    state.tables.listings = Array.from({ length: 2500 }, (_, i) => ({
      id: `l${i}`, slug: `card-${i}`, seller_id: 's1', created_at: '2026-09-01T00:00:00Z',
    }));
    const { body } = await run();
    expect(state.ranges.listings).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(body).toContain(loc('/marketplace/l0/card-0'));
    expect(body).toContain(loc('/marketplace/l2499/card-2499'));
    expect(body).toContain('<!-- Marketplace listings (2500) -->');
  });

  it('uses active listings as the public-seller content gate', async () => {
    state.tables.listings = [{ id: 'l1', slug: 'x', seller_id: 'seller-with-stock' }];
    state.tables.profiles = [
      { id: 'seller-with-stock', updated_at: '2026-09-01T00:00:00Z', reviews_count: 0 },
      { id: 'empty-seller', updated_at: '2026-09-01T00:00:00Z', reviews_count: 0 },
    ];
    const { body } = await run();
    expect(body).toContain(loc('/seller/seller-with-stock'));
    expect(body).not.toContain(loc('/seller/empty-seller'));
  });
});

describe('sitemap leaves thin pages out', () => {
  it('omits the pre-launch page and the interactive community directories', async () => {
    const { body } = await run();
    for (const path of ['/launch', '/community/profiles', '/community/leaderboard', '/community/map', '/community/whatnot']) {
      expect(body, path).not.toContain(loc(path));
    }
    // The content pages next to them are still advertised.
    expect(body).toContain(loc('/community/local-traders'));
    expect(body).toContain(loc('/community/building-your-business'));
    expect(body).toContain(loc('/about'));
    expect(body).toContain(loc('/contact'));
  });

  it('lists the forum only once it has a discussion', async () => {
    let { body } = await run();
    expect(body).not.toContain(loc('/community/forum'));

    state.tables.posts = [{ id: 'p1', created_at: '2026-09-14T03:00:00Z' }];
    ({ body } = await run());
    expect(body).toContain(`${loc('/community/forum')}\n    <lastmod>2026-09-14</lastmod>`);
  });
});
