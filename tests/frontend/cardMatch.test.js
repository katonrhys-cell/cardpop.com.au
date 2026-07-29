import { describe, it, expect } from 'vitest';
import { normalizeName, setsMatch, namesMatch } from '@/utils/cardMatch.js';

describe('normalizeName', () => {
  it('lowercases and reduces punctuation to single spaces', () => {
    expect(normalizeName("  Farfetch'd  (Promo) ")).toBe('farfetch d promo');
  });

  it('is safe on missing input', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('setsMatch', () => {
  it('matches identical names regardless of case and punctuation', () => {
    expect(setsMatch('Base Set', 'base set')).toBe(true);
    expect(setsMatch('Sword & Shield', 'Sword and Shield')).toBe(false); // "and" is a real word difference
  });

  it('ignores words that do not distinguish one set from another', () => {
    expect(setsMatch('Base', 'Base Set')).toBe(true);
    expect(setsMatch('Legendary', 'Legendary Collection')).toBe(true);
  });

  it('does not let a nested set name match', () => {
    // The bug this guards: substring containment made these equal.
    expect(setsMatch('Base Set', 'Base Set 2')).toBe(false);
    expect(setsMatch('Sword & Shield', 'Sword & Shield Promo')).toBe(false);
  });

  it('ignores a season prefix present on only one side', () => {
    // Sports sets are written "2025-26 Topps Chrome" in catalogues but read off
    // the card as "Topps Chrome". The year has its own field.
    expect(setsMatch('Topps Chrome', '2025-26 Topps Chrome')).toBe(true);
    expect(setsMatch('2025-26 Topps Chrome', 'Topps Chrome')).toBe(true);
    expect(setsMatch('Topps Chrome', '2025 Topps Chrome')).toBe(true);
  });

  it('still distinguishes sets when both carry a season', () => {
    expect(setsMatch('1999 Topps Chrome', '2025-26 Topps Chrome')).toBe(false);
    expect(setsMatch('2024-25 Topps Chrome', '2025-26 Topps Chrome')).toBe(false);
  });

  it('matches when both carry the same season', () => {
    expect(setsMatch('2025-26 Topps Chrome', '2025-26 Topps Chrome')).toBe(true);
    expect(setsMatch('2025-26 Topps Chrome', '2025 Topps Chrome')).toBe(true);
  });

  it('does not mistake a trailing number for a season', () => {
    // "Base Set 2" must keep its distinguishing "2" even though it is digits.
    expect(setsMatch('Base Set 2', 'Base Set')).toBe(false);
  });

  it('does not match unrelated sets', () => {
    expect(setsMatch('Jungle', 'Team Up')).toBe(false);
    expect(setsMatch('Topps Chrome', 'Panini Prizm')).toBe(false);
  });

  it('returns false when either side is missing', () => {
    expect(setsMatch('Base Set', null)).toBe(false);
    expect(setsMatch('', 'Base Set')).toBe(false);
  });

  it('returns false when a name is nothing but a season', () => {
    expect(setsMatch('2025-26', 'Topps Chrome')).toBe(false);
  });
});

describe('namesMatch', () => {
  it('matches after normalisation', () => {
    expect(namesMatch('Austin Reaves', 'AUSTIN REAVES')).toBe(true);
  });

  it('tolerates punctuation the model may drop', () => {
    expect(namesMatch("Farfetch'd", 'Farfetchd')).toBe(true);
    expect(namesMatch('Ho-Oh', 'HoOh')).toBe(true);
  });

  it('does not accept a different player', () => {
    expect(namesMatch('Austin Reaves', 'Austin Reeves')).toBe(false);
  });

  it('does not accept a partial name', () => {
    expect(namesMatch('Charizard VMAX', 'Charizard')).toBe(false);
  });

  it('returns false when either side is missing', () => {
    expect(namesMatch('', 'Charizard')).toBe(false);
    expect(namesMatch('Charizard', null)).toBe(false);
  });
});
