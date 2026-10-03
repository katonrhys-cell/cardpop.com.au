import { describe, it, expect } from 'vitest';
import { PALMS_OFF_PRODUCTS } from '@/data/palmsOffCatalogue.js';
import { pointSizeOf, sizeGroupFor, sizeProductPath } from '@/utils/shopSizes.js';

const bySku = (sku) => PALMS_OFF_PRODUCTS.find((p) => p.sku === sku);

describe('shopSizes', () => {
  it('reads the point size from a short title', () => {
    expect(pointSizeOf(bySku('TL-55PT'))).toBe(55);
    expect(pointSizeOf({ shortTitle: 'Binder' })).toBeNull();
  });

  it('groups every top loader size, ascending', () => {
    const group = sizeGroupFor(bySku('TL-55PT'), PALMS_OFF_PRODUCTS);
    expect(group.map((o) => o.label)).toEqual(['35pt', '55pt', '75pt', '100pt', '130pt', '180pt']);
    expect(group.every((o) => o.categorySlug === 'top-loaders')).toBe(true);
  });

  it('gives the same group from any member', () => {
    const a = sizeGroupFor(bySku('TL-35PT'), PALMS_OFF_PRODUCTS).map((o) => o.sku);
    const b = sizeGroupFor(bySku('TL-180PT'), PALMS_OFF_PRODUCTS).map((o) => o.sku);
    expect(a).toEqual(b);
  });

  it('keeps mag lock cases separate from top loaders', () => {
    const group = sizeGroupFor(bySku('MAG-75PT'), PALMS_OFF_PRODUCTS);
    expect(group.length).toBeGreaterThan(1);
    expect(group.every((o) => o.sku.startsWith('MAG-'))).toBe(true);
  });

  it('offers no picker for a lone size or an unsized product', () => {
    expect(sizeGroupFor(bySku('MF-TL-35PT'), PALMS_OFF_PRODUCTS)).toEqual([]);
    expect(sizeGroupFor({ shortTitle: 'Binder', categorySlug: 'x' }, PALMS_OFF_PRODUCTS)).toEqual([]);
  });

  it('links each size to its own canonical page', () => {
    const [first] = sizeGroupFor(bySku('TL-55PT'), PALMS_OFF_PRODUCTS);
    expect(sizeProductPath(first)).toBe('/shop/top-loaders/palms-off-gaming-top-loaders-35pt');
  });
});
