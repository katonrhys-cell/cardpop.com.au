import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseRrpCsv, planRrpUpdates, splitCsvLine, updatePatch } from '../../src/utils/shopRrp.js';

describe('splitCsvLine', () => {
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(splitCsvLine('ZB-09,"Collector\'s Series, 9-Pocket ""Zip""",41.95')).toEqual([
      'ZB-09', 'Collector\'s Series, 9-Pocket "Zip"', '41.95',
    ]);
  });
});

describe('parseRrpCsv', () => {
  it('parses priced rows, skips blanks, and strips currency symbols', () => {
    const { rows, skipped, errors } = parseRrpCsv(
      'sku,title,rrp_aud\nzb-09,"Binder",$41.95\nZB-12,"Binder 12",\nMAG-35PT,Case,A$ 4.5\n',
    );
    expect(errors).toEqual([]);
    expect(skipped).toEqual(['ZB-12']);
    expect(rows).toEqual([
      { sku: 'ZB-09', rrp: 41.95, line: 2 },
      { sku: 'MAG-35PT', rrp: 4.5, line: 4 },
    ]);
  });

  it('accepts columns in any order and ignores extras', () => {
    const { rows, errors } = parseRrpCsv('rrp_aud,notes,sku\n9.99,x,TL-35PT\n');
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ sku: 'TL-35PT', rrp: 9.99, line: 2 }]);
  });

  it('reports a missing header, duplicates and bad numbers', () => {
    expect(parseRrpCsv('sku,price\nA,1\n').errors[0]).toMatch(/header/);
    const { errors } = parseRrpCsv('sku,rrp_aud\nA,1\nA,2\nB,abc\n,3\n');
    expect(errors).toEqual([
      'line 3: duplicate sku A',
      'line 4: invalid rrp_aud "abc" for B',
      'line 5: missing sku',
    ]);
  });

  it('the committed template lists every SKU with a blank RRP and no errors', () => {
    const text = readFileSync(new URL('../../data/shop-rrp.csv', import.meta.url), 'utf8');
    const { rows, skipped, errors } = parseRrpCsv(text);
    expect(errors).toEqual([]);
    // Template ships unpriced: filling it in is the operator's job.
    expect(rows.length + skipped.length).toBe(59);
  });
});

const PRODUCTS = [
  { id: 'p1', sku: 'ZB-09', title: 'Binder 9', price_aud: '0.00', retail_price_aud: null },
  { id: 'p2', sku: 'MAG-35PT', title: 'Case 35', price_aud: '4.99', retail_price_aud: null },
  { id: 'p3', sku: 'TL-35PT', title: 'Top Loader', price_aud: '9.99', retail_price_aud: '9.99' },
];

describe('planRrpUpdates', () => {
  it('sets the RRP only by default and leaves price untouched', () => {
    const { updates, unchanged, unknown } = planRrpUpdates(
      [{ sku: 'ZB-09', rrp: 41.95 }, { sku: 'TL-35PT', rrp: 9.99 }, { sku: 'NOPE', rrp: 1 }],
      PRODUCTS,
    );
    expect(unknown).toEqual(['NOPE']);
    expect(unchanged).toEqual(['TL-35PT']);
    expect(updates).toEqual([{
      id: 'p1', sku: 'ZB-09', title: 'Binder 9',
      before: { price: 0, rrp: null }, after: { price: 0, rrp: 41.95 },
    }]);
  });

  it('with setPrice, makes the RRP the selling price', () => {
    const { updates } = planRrpUpdates([{ sku: 'MAG-35PT', rrp: 5.95 }], PRODUCTS, { setPrice: true });
    expect(updates[0].after).toEqual({ price: 5.95, rrp: 5.95 });
  });

  it('with setPrice + onlyUnpriced, protects products that already have a price', () => {
    const { updates } = planRrpUpdates(
      [{ sku: 'ZB-09', rrp: 41.95 }, { sku: 'MAG-35PT', rrp: 5.95 }],
      PRODUCTS,
      { setPrice: true, onlyUnpriced: true },
    );
    expect(updates.find((u) => u.sku === 'ZB-09').after.price).toBe(41.95);
    expect(updates.find((u) => u.sku === 'MAG-35PT').after.price).toBe(4.99);
  });

  it('matches SKUs case-insensitively', () => {
    const { updates } = planRrpUpdates([{ sku: 'ZB-09', rrp: 1 }], [{ ...PRODUCTS[0], sku: 'zb-09' }]);
    expect(updates).toHaveLength(1);
  });
});

describe('updatePatch', () => {
  it('only includes price_aud when the price changes', () => {
    const rrpOnly = updatePatch({ before: { price: 4.99, rrp: null }, after: { price: 4.99, rrp: 5.95 } });
    expect(rrpOnly.retail_price_aud).toBe(5.95);
    expect(rrpOnly).not.toHaveProperty('price_aud');
    expect(rrpOnly.updated_at).toBeTruthy();

    const both = updatePatch({ before: { price: 0, rrp: null }, after: { price: 41.95, rrp: 41.95 } });
    expect(both).toMatchObject({ retail_price_aud: 41.95, price_aud: 41.95 });
  });
});
