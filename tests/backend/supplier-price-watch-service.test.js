import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/safeFetch.js', () => ({
  fetchWebpageContent: mockFetch,
  extractTextFromHtml: (html) => html,
}));

// A tiny stand-in for the Supabase query builder: records filters and writes.
const db = vi.hoisted(() => ({ watches: [], admins: [], writes: [], filters: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const builder = (table) => {
    const q = {
      select: () => q,
      not: () => q,
      order: () => q,
      limit: () => q,
      in: (col, vals) => { db.filters.push(['in', col, vals]); return q; },
      or: (expr) => { db.filters.push(['or', expr]); return q; },
      eq: (col, val) => {
        if (q._update) { db.writes.push({ table, op: 'update', match: { [col]: val }, row: q._update }); return Promise.resolve({ error: null }); }
        return q;
      },
      update: (row) => { q._update = row; return q; },
      insert: (row) => { db.writes.push({ table, op: 'insert', row }); return Promise.resolve({ error: null }); },
      then: (resolve) => resolve(table === 'profiles'
        ? { data: db.admins, error: null }
        : { data: db.watches, error: null }),
    };
    return q;
  };
  return { default: { from: builder } };
});

const { runSupplierPriceWatch } = await import('../../src/services/supplierPriceWatchService.js');

const TEMU = 'https://www.temu.com/au/slab-g-1.html';
const row = (id, over = {}) => ({
  product_id: id,
  supplier: 'Temu',
  supplier_url: TEMU,
  supplier_price_aud: '7.68',
  supplier_price_currency: 'AUD',
  supplier_price_status: 'ok',
  supplier_price_checked_at: '2026-09-01T00:00:00Z',
  shop_products: { title: `Case ${id}`, sku: `SKU-${id}`, status: 'preorder' },
  ...over,
});
const offerPage = (price) => `<script type="application/ld+json">{"@type":"Offer","price":"${price}","priceCurrency":"AUD"}</script>`;

describe('runSupplierPriceWatch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    db.watches = [];
    db.admins = [{ id: 'admin-1' }, { id: 'admin-2' }];
    db.writes = [];
    db.filters = [];
  });

  it('fetches a page shared by several colours once, and bells admins per product on a change', async () => {
    db.watches = [row('a'), row('b')];
    mockFetch.mockResolvedValue(offerPage('8.26'));

    const summary = await runSupplierPriceWatch({ now: new Date('2026-10-03T00:00:00Z') });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ checked: 2, changed: 2, notified: 4 });

    const updates = db.writes.filter((w) => w.table === 'shop_product_costs');
    expect(updates).toHaveLength(2);
    expect(updates[0].row).toMatchObject({ supplier_price_aud: 8.26, supplier_price_status: 'changed', supplier_price_error: null });
    expect(updates[0].row.supplier_price_changed_at).toBeTruthy();

    expect(db.writes.filter((w) => w.table === 'shop_supplier_price_history')).toHaveLength(2);

    const notes = db.writes.find((w) => w.table === 'notifications').row;
    expect(notes).toHaveLength(4);
    expect(notes[0]).toMatchObject({ type: 'supplier_price_change', link: '/admin/products', related_id: 'a' });
    expect(notes[0].title).toMatch(/rose/);
    expect(notes[0].body).toContain('$8.26');
    expect(notes[0].body).toContain('$7.68');
  });

  it('only asks for products not checked in the last week, unless forced', async () => {
    await runSupplierPriceWatch({ now: new Date('2026-10-08T00:00:00Z') });
    expect(db.filters).toContainEqual(['or', 'supplier_price_checked_at.is.null,supplier_price_checked_at.lte.2026-10-01T00:00:00.000Z']);

    db.filters = [];
    await runSupplierPriceWatch({ productIds: ['a'], force: true });
    expect(db.filters).toEqual([['in', 'product_id', ['a']]]);
  });

  it('keeps the last good price when a page fails, and bells only on the first failure', async () => {
    db.watches = [row('a'), row('b', { supplier_url: 'https://other.example/x', supplier_price_status: 'error' })];
    mockFetch.mockRejectedValue(new Error('Failed to fetch webpage: 403 Forbidden'));

    const summary = await runSupplierPriceWatch();

    expect(summary).toMatchObject({ checked: 2, errors: 2, notified: 2 });
    const updates = db.writes.filter((w) => w.table === 'shop_product_costs');
    for (const u of updates) {
      expect(u.row).not.toHaveProperty('supplier_price_aud');
      expect(u.row).toMatchObject({ supplier_price_status: 'error', supplier_price_error: 'Failed to fetch webpage: 403 Forbidden' });
    }
    const notes = db.writes.find((w) => w.table === 'notifications').row;
    expect(notes.every((n) => n.related_id === 'a')).toBe(true);
    expect(notes[0].title).toMatch(/Can't read supplier price/);
  });

  it('records the same price again without notifying', async () => {
    db.watches = [row('a')];
    mockFetch.mockResolvedValue(offerPage('7.68'));
    const summary = await runSupplierPriceWatch();
    expect(summary).toMatchObject({ checked: 1, changed: 0, notified: 0 });
    expect(db.writes.some((w) => w.table === 'notifications')).toBe(false);
  });

  it('skips archived products and stops starting pages once over budget', async () => {
    db.watches = [
      row('gone', { shop_products: { title: 'Old', sku: 'OLD', status: 'archived' } }),
      row('a', { supplier_url: 'https://one.example/a' }),
      row('b', { supplier_url: 'https://two.example/b' }),
    ];
    mockFetch.mockResolvedValue(offerPage('7.68'));
    const summary = await runSupplierPriceWatch({ budgetMs: -1 });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ checked: 0, skipped: 2 });
  });
});
