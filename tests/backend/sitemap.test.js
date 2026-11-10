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

  it('lists a collection or a shop section only while it has something in it', async () => {
    let { body } = await run();
    expect(body).toContain(loc('/collections'));
    expect(body).not.toContain(loc('/collections/golf'));
    expect(body).not.toContain(loc('/collections/pokemon'));
    expect(body).not.toContain(loc('/shop/sealed-boxes'));
    expect(body).not.toContain(loc('/shop/singles'));

    state.tables.listings = [{ id: 'l1', slug: 'x', seller_id: 's1', vault_item: { card_name: 'Charizard', collection: 'Pokémon' } }];
    state.tables.shop_products = [{ id: 'p1', title: 'Booster Box', slug: 'booster-box', category: 'sealed', product_type: 'sealed' }];
    ({ body } = await run());
    expect(body).toContain(loc('/collections/pokemon'));
    expect(body).not.toContain(loc('/collections/golf'));
    expect(body).toContain(loc('/shop/sealed-boxes'));
    expect(body).not.toContain(loc('/shop/singles'));
  });

  it('lists the forum only once it has a discussion', async () => {
    let { body } = await run();
    expect(body).not.toContain(loc('/community/forum'));

    state.tables.posts = [{ id: 'p1', created_at: '2026-09-14T03:00:00Z' }];
    ({ body } = await run());
    expect(body).toContain(`${loc('/community/forum')}\n    <lastmod>2026-09-14</lastmod>`);
  });
});

describe('sitemap event organiser pages', () => {
  it('lists an organiser once a public event names them, dated by the newest event', async () => {
    state.tables.event_organisers = [
      { id: 'o1', name: 'Sports Addicts Australia', slug: 'sports-addicts-australia', updated_at: '2026-09-01T00:00:00Z' },
      { id: 'o2', name: 'Quiet Org', slug: 'quiet-org', updated_at: '2026-09-01T00:00:00Z' },
      { id: 'o3', name: 'No Slug Yet', slug: null },
    ];
    state.tables.events = [
      { id: 'e1', organizer_name: 'Fast Break Trading Cards & Sports Addicts Australia', updated_at: '2026-10-20T00:00:00Z' },
      { id: 'e2', organizer_name: 'Sports Addicts Australia', updated_at: '2026-10-05T00:00:00Z' },
    ];
    const { body } = await run();
    expect(body).toContain(`${loc('/events/organisers/sports-addicts-australia')}\n    <lastmod>2026-10-20</lastmod>`);
    // No events name them → their page is noindex, so it isn't advertised.
    expect(body).not.toContain(loc('/events/organisers/quiet-org'));
    expect(body).not.toContain('/events/organisers/null');
  });
});

describe('sitemap grading scale pages', () => {
  it('lists every company scale from the shared data file', async () => {
    const { body } = await run();
    for (const scale of ['psa', 'bgs', 'cgc', 'ace']) {
      expect(body, scale).toContain(loc(`/grading/scales/${scale}`));
    }
  });
});

describe('sitemap card price pages', () => {
  it('lists a price page only once its latest snapshot found listings', async () => {
    state.tables.tracked_cards = [
      { id: 'c1', slug: 'charizard-base-set', category: 'pokemon', card_price_snapshots: [{ snapshot_date: '2026-11-04', raw_count: 17, graded_count: 13 }] },
      { id: 'c2', slug: 'graded-only', category: 'pokemon', card_price_snapshots: [{ snapshot_date: '2026-11-04', raw_count: 0, graded_count: 3 }] },
      // eBay search came back empty → a page with no prices on it.
      { id: 'c3', slug: 'empty-search', category: 'nrl', card_price_snapshots: [{ snapshot_date: '2026-11-04', raw_count: 0, graded_count: 0 }] },
      // Just added; not priced yet.
      { id: 'c4', slug: 'brand-new', category: 'afl', card_price_snapshots: [] },
    ];
    const { body } = await run();
    expect(body).toContain(`${loc('/prices/pokemon/charizard-base-set')}\n    <lastmod>2026-11-04</lastmod>`);
    expect(body).toContain(loc('/prices/pokemon/graded-only'));
    expect(body).not.toContain(loc('/prices/nrl/empty-search'));
    expect(body).not.toContain(loc('/prices/afl/brand-new'));
    // The category hubs are always listed.
    expect(body).toContain(loc('/prices/nrl'));
  });
});

describe('sitemap city card-show pages', () => {
  it('lists a city only while its state has an upcoming approved event', async () => {
    state.tables.events = [
      { id: 'e1', slug: 'vic-show', state: 'VIC', status: 'approved', start_date: '2099-01-10', updated_at: '2026-10-20T00:00:00Z' },
      { id: 'e2', slug: 'nsw-old', state: 'NSW', status: 'completed', start_date: '2099-01-10', updated_at: '2026-10-20T00:00:00Z' },
    ];
    const { body } = await run();
    expect(body).toContain(`${loc('/card-shows/melbourne')}\n    <lastmod>2026-10-20</lastmod>`);
    expect(body).not.toContain(loc('/card-shows/sydney'));
    expect(body).not.toContain(loc('/card-shows/darwin'));
  });
});
