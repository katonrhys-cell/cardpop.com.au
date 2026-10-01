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
