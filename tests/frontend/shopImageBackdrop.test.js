import { describe, it, expect } from 'vitest';
import { hasDarkBackdrop } from '@/utils/shopImageBackdrop.js';

const base = 'https://cardpop.com.au/images/shop/acryshield/';

describe('hasDarkBackdrop', () => {
  it('recognises the numbered Acryshield studio shots', () => {
    expect(hasDarkBackdrop(`${base}stackable/etb-blue-1.jpg`)).toBe(true);
    expect(hasDarkBackdrop(`${base}booster-box-2.jpg`)).toBe(true);
    expect(hasDarkBackdrop(`${base}single-card-case-1.jpg`)).toBe(true);
    expect(hasDarkBackdrop('/images/shop/acryshield/mew-upc-3.jpg?v=2')).toBe(true);
  });

  it('leaves the light lifestyle shots and everything else alone', () => {
    expect(hasDarkBackdrop(`${base}etb.jpg`)).toBe(false);
    expect(hasDarkBackdrop(`${base}stackable/stackable-base.jpg`)).toBe(false);
    expect(hasDarkBackdrop('https://cardpop.com.au/images/shop/binders/binder-1.jpg')).toBe(false);
    expect(hasDarkBackdrop(null)).toBe(false);
    expect(hasDarkBackdrop('')).toBe(false);
  });
});
