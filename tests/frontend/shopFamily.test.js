import { describe, it, expect, vi } from 'vitest';
import {
  sortFamily, familyAsVariants, pickDefaultSibling, familyProductPath, productImages, fetchFamily, packagingFirst,
  siblingAvailable, familyHasPurchasable,
} from '@/utils/shopFamily.js';

const S = (o) => ({ id: o.sku, title: `Zip Binder — ${o.colour}`, stock_quantity: 0, ...o });
const family = [
  S({ sku: 'ZB-04-RED', colour: 'Red' }),
  S({ sku: 'ZB-04-BLK', colour: 'Black' }),
  S({ sku: 'ZB-04-TQS', colour: 'Turquoise', colour_hex: '#2FB3AE' }),
  S({ sku: 'ZB-04-XYZ', colour: 'Aurora' }),
];

describe('shop colour families', () => {
  it('orders swatches neutrals first, round the wheel, unknown colours last', () => {
    expect(sortFamily(family).map((s) => s.colour)).toEqual(['Black', 'Turquoise', 'Red', 'Aurora']);
  });

  it('adapts siblings to the VariantPicker shape, keyed by product id', () => {
    const opts = familyAsVariants(family);
    expect(opts[1]).toEqual({ id: 'ZB-04-TQS', sku: 'ZB-04-TQS', colour: 'Turquoise', colour_hex: '#2FB3AE', stock_quantity: 0, status: 'active', sort_order: 1 });
  });

  it('defaults to the first colour in stock, else the first swatch', () => {
    expect(pickDefaultSibling(family).sku).toBe('ZB-04-BLK');
    expect(pickDefaultSibling([...family, S({ sku: 'ZB-04-PNK', colour: 'Pink', stock_quantity: 3 })]).sku).toBe('ZB-04-PNK');
    expect(pickDefaultSibling([])).toBeNull();
  });

  it('treats pre-order siblings as available (unlimited) and flags them for the picker', () => {
    const withPreorder = [
      S({ sku: 'ZB-04-BLK', colour: 'Black', status: 'active', stock_quantity: 0 }),
      S({ sku: 'ZB-04-RED', colour: 'Red', status: 'preorder', stock_quantity: 0 }),
    ];
    // Sold-out active Black is skipped; the pre-order Red is the default.
    expect(pickDefaultSibling(withPreorder).sku).toBe('ZB-04-RED');
    const opts = familyAsVariants(withPreorder);
    expect(opts.find((o) => o.sku === 'ZB-04-RED').preorder).toBe(true);
    expect(opts.find((o) => o.sku === 'ZB-04-BLK').preorder).toBeUndefined();
    expect(siblingAvailable(withPreorder[0])).toBe(false);
    expect(siblingAvailable(withPreorder[1])).toBe(true);
    // A coming-soon sibling with stock is not buyable.
    expect(siblingAvailable({ status: 'coming_soon', stock_quantity: 4 })).toBe(false);
  });

  it('shows availability whenever any sibling is purchasable', () => {
    expect(familyHasPurchasable([{ status: 'coming_soon' }, { status: 'preorder' }])).toBe(true);
    expect(familyHasPurchasable([{ status: 'coming_soon' }])).toBe(false);
    expect(familyHasPurchasable(family)).toBe(true); // no status → legacy rows
  });

  it('links to the sibling product page', () => {
    expect(familyProductPath({ id: 'abc', title: 'Zip Binder — Pink' })).toBe('/product/shop/abc/zip-binder-pink');
  });

  it('reads images, falling back to image_url', () => {
    expect(productImages({ images: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(productImages({ images: [], image_url: 'c' })).toEqual(['c']);
    expect(productImages(null)).toEqual([]);
  });

  it('leads the gallery with the branded packaging shot', () => {
    const imgs = ['b/ZB-12-BLU_x_front.png', 'b/ZB-12-BLU_x_profile.png', 'b/ZB-12-BLU_x_pkg1.png', 'b/ZB-12-BLU_x_pkg2.png'];
    expect(productImages({ images: imgs })).toEqual([imgs[2], imgs[0], imgs[1], imgs[3]]);
    expect(packagingFirst(['a_front.png', 'a_pkg.png'])).toEqual(['a_pkg.png', 'a_front.png']);
    expect(packagingFirst(['a_pkg1.png', 'a_front.png'])).toEqual(['a_pkg1.png', 'a_front.png']);
    expect(packagingFirst(['a_front.png', 'a_pkg2.png'])).toEqual(['a_front.png', 'a_pkg2.png']);
    expect(packagingFirst(null)).toEqual([]);
  });

  it('fetchFamily filters by family and status, and never throws', async () => {
    const calls = [];
    const q = {
      select: (c) => { calls.push(['select', c]); return q; },
      eq: (k, v) => { calls.push(['eq', k, v]); return q; },
      in: (k, v) => { calls.push(['in', k, v]); return Promise.resolve({ data: family, error: null }); },
    };
    const rows = await fetchFamily({ from: () => q }, 'ZB-04', ['active', 'coming_soon']);
    expect(rows.map((r) => r.colour)).toEqual(['Black', 'Turquoise', 'Red', 'Aurora']);
    expect(calls).toContainEqual(['eq', 'family_sku', 'ZB-04']);
    expect(await fetchFamily({ from: () => { throw new Error('no column'); } }, 'ZB-04')).toEqual([]);
    expect(await fetchFamily({ from: vi.fn() }, null)).toEqual([]);
  });
});

describe('static Palms Off galleries', () => {
  it('every binder and catalogue gallery with a packaging shot leads with it', async () => {
    const { BINDER_PRODUCTS } = await import('@/data/shopBinderProducts.js');
    const { PALMS_OFF_PRODUCTS } = await import('@/data/palmsOffCatalogue.js');
    const galleries = [
      ...BINDER_PRODUCTS.map((p) => p.imageFiles),
      ...PALMS_OFF_PRODUCTS.map((p) => p.imagePaths),
    ].filter(Boolean);
    expect(galleries.length).toBeGreaterThan(BINDER_PRODUCTS.length);
    for (const g of galleries) expect(packagingFirst(g)).toEqual(g);
  });
});
