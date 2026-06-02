import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slugify.js';

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('lebron james rc auto')).toBe('lebron-james-rc-auto');
  });

  it('strips diacritics / accented characters', () => {
    expect(slugify('Pokémon')).toBe('pokemon');
    expect(slugify('Résumé')).toBe('resume');
    expect(slugify('Café')).toBe('cafe');
  });

  it('preserves hyphens in the input', () => {
    expect(slugify('2003-04 Upper Deck')).toBe('2003-04-upper-deck');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('foo   bar')).toBe('foo-bar');
  });

  it('collapses multiple hyphens into a single hyphen', () => {
    expect(slugify('foo--bar')).toBe('foo-bar');
  });

  it('strips special characters that are not alphanumeric, hyphens, or spaces', () => {
    expect(slugify('Charizard (Holo) #6/102')).toBe('charizard-holo-6-102');
    // dots and dollar signs become spaces, so 99.99 → 99-99
    expect(slugify('price: $99.99!')).toBe('price-99-99');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('handles an empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles the default argument (no argument passed)', () => {
    expect(slugify()).toBe('');
  });

  it('handles a string that is all special characters', () => {
    expect(slugify('!!!###')).toBe('');
  });

  it('handles numbers', () => {
    expect(slugify('2024 Topps Chrome')).toBe('2024-topps-chrome');
  });
});
