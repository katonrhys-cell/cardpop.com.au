import { describe, it, expect, vi } from 'vitest';
import {
  sortFamily, familyAsVariants, pickDefaultSibling, familyProductPath, productImages, fetchFamily,
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

  it('links to the sibling product page', () => {
    expect(familyProductPath({ id: 'abc', title: 'Zip Binder — Pink' })).toBe('/product/shop/abc/zip-binder-pink');
  });

  it('reads images, falling back to image_url', () => {
    expect(productImages({ images: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(productImages({ images: [], image_url: 'c' })).toEqual(['c']);
    expect(productImages(null)).toEqual([]);
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
