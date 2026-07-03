import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { from: vi.fn() } }));

import { formatAud, PRICE_CATEGORIES, CATEGORY_ORDER } from '@/lib/cardPrices.js';

describe('formatAud', () => {
  it('formats AUD currency', () => {
    expect(formatAud(85.5)).toBe('$85.50');
  });

  it('drops cents for large amounts', () => {
    expect(formatAud(1250)).toBe('$1,250');
  });

  it('renders an em dash for missing values', () => {
    expect(formatAud(null)).toBe('—');
    expect(formatAud(undefined)).toBe('—');
  });
});

describe('price categories', () => {
  it('orders every category exactly once', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(PRICE_CATEGORIES).sort());
  });

  it('gives each category a label and blurb', () => {
    for (const key of CATEGORY_ORDER) {
      expect(PRICE_CATEGORIES[key].label).toBeTruthy();
      expect(PRICE_CATEGORIES[key].blurb).toBeTruthy();
    }
  });
});
