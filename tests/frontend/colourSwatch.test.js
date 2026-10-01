import { describe, it, expect } from 'vitest';
import { colourHex, swatchStyle } from '@/utils/colourSwatch.js';
import { colourListText, sortColourNames } from '@/utils/shopFamily.js';

describe('colourSwatch', () => {
  it("prefers the row's own hex", () => {
    expect(colourHex('Green', '#123456')).toBe('#123456');
  });

  it('falls back to the colour name when the row has no hex', () => {
    for (const name of ['White', 'Jade', 'Green', 'Orange', 'Rose', ' navy ']) {
      expect(colourHex(name, null)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('draws Clear as a see-through pattern, not a missing dot', () => {
    expect(swatchStyle('Clear', '')).toHaveProperty('backgroundImage');
  });

  it('returns null for a colour it cannot place', () => {
    expect(swatchStyle('Galaxy', null)).toBeNull();
  });
});

describe('colour range copy', () => {
  it('orders names like the picker and drops duplicates', () => {
    expect(sortColourNames(['Purple', 'Black', 'Clear', 'White', 'black'])).toEqual(['Black', 'White', 'Clear', 'Purple']);
  });

  it('writes the range as a sentence fragment', () => {
    expect(colourListText(['Red', 'Black', 'White'])).toBe('Black, White and Red');
    expect(colourListText(['Red'])).toBe('Red');
  });
});

describe('colour data stays consistent', () => {
  it('draws Clear as see-through even if a hex was saved for it', () => {
    expect(swatchStyle('Clear', '#FFFFFF')).toHaveProperty('backgroundImage');
  });

  it('every catalogue colour name has a swatch', async () => {
    const { PALMS_OFF_PRODUCTS } = await import('@/data/palmsOffCatalogue.js');
    const { BINDER_PRODUCTS } = await import('@/data/shopBinderProducts.js');
    const names = [
      ...PALMS_OFF_PRODUCTS.flatMap((p) => p.colours || []),
      ...BINDER_PRODUCTS.flatMap((p) => p.colours.map((c) => c.name)),
    ];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(swatchStyle(name, null), name).not.toBeNull();
  });
});
