import { describe, it, expect } from 'vitest';
import { buildCatalogueKey, isStrongCatalogueKey } from '@/utils/catalogueKey.js';

const card = (over = {}) => ({
  collection: 'NBA', setName: 'Topps Chrome', cardNumber: '126', name: 'Austin Reaves', ...over,
});

describe('buildCatalogueKey', () => {
  it('is stable across scans of the same card', () => {
    expect(buildCatalogueKey(card())).toBe(buildCatalogueKey(card()));
  });

  it('ignores case and punctuation differences between reads', () => {
    expect(buildCatalogueKey(card({ setName: 'topps  chrome' })))
      .toBe(buildCatalogueKey(card({ setName: 'Topps Chrome' })));
  });

  it('treats the same number written differently as the same card', () => {
    expect(buildCatalogueKey(card({ cardNumber: '#126' })))
      .toBe(buildCatalogueKey(card({ cardNumber: '126' })));
  });

  it('separates a parallel from the base card', () => {
    // The whole point: these share name, set, number and year but are worth
    // very different amounts, so they are different catalogue entries.
    expect(buildCatalogueKey(card({ parallel: 'Red Laser' })))
      .not.toBe(buildCatalogueKey(card()));
  });

  it('separates an insert from the base product', () => {
    expect(buildCatalogueKey(card({ insertName: 'Ball of Duty' })))
      .not.toBe(buildCatalogueKey(card()));
  });

  it('separates card 4 of different sets', () => {
    // "4/102" and "4/165" are both card 4, of different sets.
    expect(buildCatalogueKey(card({ cardNumber: '4/102' })))
      .not.toBe(buildCatalogueKey(card({ cardNumber: '4/165' })));
  });

  it('separates different hobbies and different products', () => {
    expect(buildCatalogueKey(card({ collection: 'Pokemon' }))).not.toBe(buildCatalogueKey(card()));
    expect(buildCatalogueKey(card({ setName: 'Donruss' }))).not.toBe(buildCatalogueKey(card()));
  });

  it('refuses to build a key without a hobby or a product', () => {
    // An under-identified scan must not create an entry later scans merge into
    // — that poisons the record permanently.
    expect(buildCatalogueKey(card({ collection: '' }))).toBeNull();
    expect(buildCatalogueKey(card({ setName: null }))).toBeNull();
  });

  it('refuses a key with neither a number nor a name', () => {
    expect(buildCatalogueKey({ collection: 'NBA', setName: 'Topps Chrome' })).toBeNull();
  });

  it('falls back to the name when no number was read', () => {
    const key = buildCatalogueKey(card({ cardNumber: '' }));
    expect(key).toContain('name:');
    expect(isStrongCatalogueKey(key)).toBe(false);
  });

  it('marks a number-based key as strong', () => {
    expect(isStrongCatalogueKey(buildCatalogueKey(card()))).toBe(true);
  });

  it('treats a null key as not strong', () => {
    expect(isStrongCatalogueKey(null)).toBe(false);
  });

  it('is safe on empty input', () => {
    expect(buildCatalogueKey()).toBeNull();
    expect(buildCatalogueKey({})).toBeNull();
  });
});
