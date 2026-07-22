import { describe, it, expect } from 'vitest';
import { sanitizeSearch, tokenizeSearch, relevanceScore, rankItems } from '@/utils/searchRanking.js';

describe('sanitizeSearch', () => {
  it('strips PostgREST filter-breaking characters and collapses whitespace', () => {
    expect(sanitizeSearch('  Charizard   (Shadowless) 100% ')).toBe('Charizard Shadowless 100');
    expect(sanitizeSearch('a,b,c')).toBe('a b c');
  });
  it('handles nullish input', () => {
    expect(sanitizeSearch(undefined)).toBe('');
    expect(sanitizeSearch(null)).toBe('');
  });
});

describe('tokenizeSearch', () => {
  it('splits into lowercased words, dropping <2-char tokens and duplicates', () => {
    expect(tokenizeSearch('Charizard Base Set')).toEqual(['charizard', 'base', 'set']);
    expect(tokenizeSearch('a Charizard a')).toEqual(['charizard']); // "a" dropped, dedup
  });
  it('caps the number of tokens at 6', () => {
    expect(tokenizeSearch('one two three four five six seven eight')).toHaveLength(6);
  });
});

describe('relevanceScore', () => {
  const q = 'charizard';
  it('ranks an exact title match above a prefix match above a substring match', () => {
    const exact = relevanceScore('Charizard', 'Charizard Base Set', q, ['charizard']);
    const prefix = relevanceScore('Charizard VMAX', 'Charizard VMAX', q, ['charizard']);
    const substr = relevanceScore('Dark Charizard', 'Dark Charizard', q, ['charizard']);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substr);
  });

  it('rewards rows that match every token over rows that match only some', () => {
    const tokens = ['charizard', 'base'];
    const all = relevanceScore('Charizard', 'Charizard Base Set', 'charizard base', tokens);
    const some = relevanceScore('Charizard', 'Charizard Jungle', 'charizard base', tokens);
    expect(all).toBeGreaterThan(some);
  });

  it('uses the haystack when the title itself does not contain the term', () => {
    const viaHaystack = relevanceScore('Pikachu', 'Pikachu charizard-adjacent set', q, ['charizard']);
    const noMatch = relevanceScore('Pikachu', 'Pikachu Jungle', q, ['charizard']);
    expect(viaHaystack).toBeGreaterThan(noMatch);
  });
});

describe('rankItems', () => {
  it('orders items best-first and trims to the limit', () => {
    const items = [
      { _title: 'Dark Charizard', _haystack: 'Dark Charizard' },
      { _title: 'Charizard', _haystack: 'Charizard Base Set' },
      { _title: 'Charizard VMAX', _haystack: 'Charizard VMAX' },
    ];
    const ranked = rankItems(items, 'charizard', ['charizard'], 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]._title).toBe('Charizard'); // exact match wins
    expect(ranked[1]._title).toBe('Charizard VMAX'); // prefix beats mid-string
  });
});
