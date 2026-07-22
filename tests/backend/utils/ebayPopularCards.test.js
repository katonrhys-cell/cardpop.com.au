import { describe, it, expect } from 'vitest';
import { POPULAR_CARDS, findPopularCard } from '../../../src/utils/ebayPopularCards.js';

describe('POPULAR_CARDS data integrity', () => {
  it('is a non-empty list', () => {
    expect(Array.isArray(POPULAR_CARDS)).toBe(true);
    expect(POPULAR_CARDS.length).toBeGreaterThan(0);
  });

  it('every entry has the required non-empty string fields', () => {
    for (const card of POPULAR_CARDS) {
      for (const field of ['id', 'name', 'set', 'collection', 'searchQuery']) {
        expect(typeof card[field], `${card.id}.${field}`).toBe('string');
        expect(card[field].length, `${card.id}.${field}`).toBeGreaterThan(0);
      }
    }
  });

  it('has no duplicate ids (findPopularCard resolves unambiguously)', () => {
    const ids = POPULAR_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses slug-style ids (lowercase, no spaces)', () => {
    for (const card of POPULAR_CARDS) {
      expect(card.id, card.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('findPopularCard', () => {
  it('returns the matching card config by id', () => {
    const first = POPULAR_CARDS[0];
    expect(findPopularCard(first.id)).toBe(first);
  });

  it('returns null for an unknown id', () => {
    expect(findPopularCard('does-not-exist')).toBeNull();
  });

  it('returns null for a missing/blank id', () => {
    expect(findPopularCard(undefined)).toBeNull();
    expect(findPopularCard('')).toBeNull();
  });
});
