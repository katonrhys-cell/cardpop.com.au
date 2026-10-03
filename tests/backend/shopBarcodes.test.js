import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isValidGtin, parseBarcodeCsv, planBarcodeUpdates } from '../../src/utils/shopBarcodes.js';

describe('isValidGtin', () => {
  it('accepts real EAN-13 and UPC-A codes', () => {
    expect(isValidGtin('1209202001436')).toBe(true);
    expect(isValidGtin('396483852909')).toBe(true);
  });
  it('rejects a bad check digit or shape', () => {
    expect(isValidGtin('1209202001437')).toBe(false);
    expect(isValidGtin('936177002932')).toBe(false);
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('')).toBe(false);
  });
});

describe('parseBarcodeCsv', () => {
  it('parses valid rows, flags bad check digits, skips blanks', () => {
    const csv = [
      'sku,title,barcode',
      'zb-04-blk,"Binder, Black",1209202001436',
      'ZB-04-BAD,Bad one,1209202001437',
      'ZB-04-NONE,No code,',
    ].join('\n');
    const r = parseBarcodeCsv(csv);
    expect(r.rows).toEqual([{ sku: 'ZB-04-BLK', barcode: '1209202001436', title: 'Binder, Black', line: 2 }]);
    expect(r.invalid).toEqual([{ sku: 'ZB-04-BAD', barcode: '1209202001437', line: 3 }]);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([]);
  });

  it('errors on duplicate SKUs and a barcode shared by two SKUs', () => {
    const r = parseBarcodeCsv('sku,barcode\nA,1209202001436\nA,396483852909\nB,1209202001436');
    expect(r.errors).toHaveLength(2);
  });

  it('requires the header columns', () => {
    expect(parseBarcodeCsv('sku,title\nA,x').errors[0]).toMatch(/barcode/);
    expect(parseBarcodeCsv('').errors[0]).toMatch(/empty/);
  });

  it('the committed data/shop-barcodes.csv parses without errors or duplicates', () => {
    const csv = fs.readFileSync(path.resolve(__dirname, '../../data/shop-barcodes.csv'), 'utf8');
    const r = parseBarcodeCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBeGreaterThan(150);
  });
});

describe('planBarcodeUpdates', () => {
  const rows = [
    { sku: 'P-NEW', barcode: '1209202001436', title: 'New' },
    { sku: 'P-SAME', barcode: '396483852909', title: 'Same' },
    { sku: 'P-DIFF', barcode: '1209202001450', title: 'Diff' },
    { sku: 'V-1', barcode: '1209202001474', title: 'Variant' },
    { sku: 'GHOST', barcode: '1209202001481', title: 'Ghost' },
  ];
  const products = [
    { id: 'p1', sku: 'P-NEW', title: 'New', barcode: null },
    { id: 'p2', sku: 'p-same', title: 'Same', barcode: '396483852909' },
    { id: 'p3', sku: 'P-DIFF', title: 'Diff', barcode: '9999999999999' },
  ];
  const variants = [{ id: 'v1', sku: 'V-1', barcode: null }];

  it('plans fills, matches variants, and reports the rest', () => {
    const plan = planBarcodeUpdates(rows, products, variants);
    expect(plan.updates.map((u) => [u.kind, u.sku])).toEqual([['product', 'P-NEW'], ['variant', 'V-1']]);
    expect(plan.unchanged).toEqual(['P-SAME']);
    expect(plan.conflicts).toEqual([{ sku: 'P-DIFF', existing: '9999999999999', incoming: '1209202001450' }]);
    expect(plan.unknown).toEqual(['GHOST']);
  });

  it('replaces a different barcode only with overwrite', () => {
    const plan = planBarcodeUpdates(rows, products, variants, { overwrite: true });
    expect(plan.updates.map((u) => u.sku)).toContain('P-DIFF');
    expect(plan.conflicts).toEqual([]);
  });
});
