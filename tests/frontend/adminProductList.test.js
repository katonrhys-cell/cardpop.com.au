import { describe, it, expect } from 'vitest';
import {
  sectionOf, filterProducts, sortProducts, groupProducts, categoryOptions, brandOptions, OTHER_SECTION,
} from '@/utils/adminProductList.js';

const P = (o) => ({ id: o.sku, status: 'active', brand: null, ...o });
const products = [
  P({ sku: 'TL-55PT', title: 'Palms Off Gaming Top Loaders 55pt', category: 'Top Loaders', price_aud: 7.5, stock_quantity: 0, status: 'coming_soon', brand: 'Palms Off Gaming' }),
  P({ sku: 'CP-TOP-LOADERS-25-PACK', title: 'Top Loaders 3x4in - 25 Pack', category: 'Top Loaders', price_aud: 9.99, stock_quantity: 12 }),
  P({ sku: 'CP-PENNY-SLEEVES-100-PACK', title: 'Penny Sleeves - 100 Pack', category: 'Penny Sleeves', price_aud: 2.95, stock_quantity: 40 }),
  P({ sku: 'ZB-09', title: 'Palms Off Gaming 9-Pocket Zip Binder', category: 'Binders', price_aud: 39.95, stock_quantity: null, status: 'draft', brand: 'Palms Off Gaming' }),
  P({ sku: 'CP-BUBBLE-MAILERS-10-PACK', title: 'Bubble Mailers - 10 Pack', category: 'Bubble Mailers', price_aud: 6.95, stock_quantity: 5 }),
  P({ sku: 'X-1', title: 'Mystery Item', category: 'Not A Real Category', price_aud: 1, stock_quantity: 1, status: 'archived' }),
];
const skus = (list) => list.map((p) => p.sku);

describe('sectionOf', () => {
  it('maps a leaf category to its Shop-menu section, case-insensitively', () => {
    expect(sectionOf({ category: 'Top Loaders' })).toBe('Protection');
    expect(sectionOf({ category: 'binders' })).toBe('Storage');
    expect(sectionOf({ category: 'Bubble Mailers' })).toBe('Shipping');
  });

  it('puts unknown or missing categories in Other', () => {
    expect(sectionOf({ category: 'Not A Real Category' })).toBe(OTHER_SECTION);
    expect(sectionOf({ category: null })).toBe(OTHER_SECTION);
  });
});

describe('filterProducts', () => {
  it('filters by status, section, category and brand', () => {
    expect(skus(filterProducts(products, { status: 'coming_soon' }))).toEqual(['TL-55PT']);
    expect(skus(filterProducts(products, { section: 'Protection' }))).toEqual(['TL-55PT', 'CP-TOP-LOADERS-25-PACK', 'CP-PENNY-SLEEVES-100-PACK']);
    expect(skus(filterProducts(products, { category: 'Binders' }))).toEqual(['ZB-09']);
    expect(filterProducts(products, { brand: 'Palms Off Gaming' })).toHaveLength(2);
    // A blank brand is a CardPop house product.
    expect(filterProducts(products, { brand: 'CardPop' })).toHaveLength(4);
  });

  it("treats 'all' and blanks as no filter, and combines filters", () => {
    expect(filterProducts(products, { status: 'all', section: '', brand: 'all' })).toHaveLength(products.length);
    expect(skus(filterProducts(products, { section: 'Protection', brand: 'CardPop' }))).toEqual(['CP-TOP-LOADERS-25-PACK', 'CP-PENNY-SLEEVES-100-PACK']);
  });

  it('searches title, SKU, category, brand and colour-variant barcodes', () => {
    expect(skus(filterProducts(products, { search: 'penny' }))).toEqual(['CP-PENNY-SLEEVES-100-PACK']);
    expect(filterProducts(products, { search: 'palms off' })).toHaveLength(2);
    const variantsByProduct = { 'ZB-09': [{ sku: 'ZB-09-RED', barcode: '9351234567890', colour: 'Red' }] };
    expect(skus(filterProducts(products, { search: '9351234567890' }, { variantsByProduct }))).toEqual(['ZB-09']);
  });

  it('searches colour, family SKU and product barcode on colour products', () => {
    const colourRows = [P({ sku: 'ZB-04-PNK', title: 'Zip Binder — Pink', category: 'Binders', family_sku: 'ZB-04', colour: 'Pink', barcode: '1209202001474' })];
    expect(filterProducts(colourRows, { search: 'pink' })).toHaveLength(1);
    expect(filterProducts(colourRows, { search: 'zb-04' })).toHaveLength(1);
    expect(filterProducts(colourRows, { search: '1209202001474' })).toHaveLength(1);
  });
});

describe('sortProducts', () => {
  it('sorts by name by default', () => {
    expect(sortProducts(products)[0].title).toBe('Bubble Mailers - 10 Pack');
  });

  it('sorts numerically in both directions', () => {
    expect(sortProducts(products, 'price', 'desc')[0].sku).toBe('ZB-09');
    expect(sortProducts(products, 'price', 'asc')[0].sku).toBe('X-1');
  });

  it('always sinks blank values to the bottom', () => {
    expect(sortProducts(products, 'stock', 'asc').at(-1).sku).toBe('ZB-09');
    expect(sortProducts(products, 'stock', 'desc').at(-1).sku).toBe('ZB-09');
  });

  it('sorts by cost and margin from the admin cost map', () => {
    const costs = {
      'TL-55PT': { wholesale_inc_gst_aud: 4.5, wholesale_ex_gst_aud: 4.09 },
      'ZB-09': { wholesale_inc_gst_aud: 20, wholesale_ex_gst_aud: 18.18 },
    };
    expect(skus(sortProducts(products, 'cost', 'desc', { costs })).slice(0, 2)).toEqual(['ZB-09', 'TL-55PT']);
    // ZB-09 margin ≈ 50%, TL-55PT ≈ 40%.
    expect(skus(sortProducts(products, 'margin', 'desc', { costs })).slice(0, 2)).toEqual(['ZB-09', 'TL-55PT']);
  });

  it('orders status the way an admin works through it', () => {
    expect(sortProducts(products, 'status').map((p) => p.status)).toEqual(['active', 'active', 'active', 'coming_soon', 'draft', 'archived']);
  });

  it('does not mutate its input', () => {
    const copy = [...products];
    sortProducts(products, 'price', 'desc');
    expect(products).toEqual(copy);
  });
});

describe('groupProducts', () => {
  it('groups into sections and categories in Shop-menu order, Other last', () => {
    const groups = groupProducts(sortProducts(products));
    expect(groups.map((g) => g.section)).toEqual(['Protection', 'Storage', 'Shipping', OTHER_SECTION]);
    expect(groups[0].count).toBe(3);
    // Penny Sleeves precedes Top Loaders in the Protection menu.
    expect(groups[0].categories.map((c) => c.category)).toEqual(['Penny Sleeves', 'Top Loaders']);
  });

  it('keeps the chosen sort order inside a category', () => {
    const groups = groupProducts(sortProducts(products, 'price', 'desc'));
    expect(skus(groups[0].categories[1].products)).toEqual(['CP-TOP-LOADERS-25-PACK', 'TL-55PT']);
  });
});

describe('option lists', () => {
  it('lists categories present, optionally narrowed to a section', () => {
    expect(categoryOptions(products, 'Protection')).toEqual(['Penny Sleeves', 'Top Loaders']);
    expect(categoryOptions(products)).toContain('Not A Real Category');
  });

  it('lists brands, naming blank-brand products CardPop', () => {
    expect(brandOptions(products)).toEqual(['CardPop', 'Palms Off Gaming']);
  });
});
