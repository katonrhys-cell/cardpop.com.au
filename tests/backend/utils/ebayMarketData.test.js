import { describe, it, expect } from 'vitest';
import {
  parseCondition,
  extractCardInfo,
  aggregateCardData,
  calculateStats,
} from '../../../src/utils/ebayMarketData.js';

describe('parseCondition', () => {
  it.each([
    ['3000', 'New'],
    ['3010', 'Like New'],
    ['3020', 'Good'],
    ['3030', 'Fair'],
    ['4000', 'Used'],
  ])('maps condition ID %s → %s', (id, expected) => {
    expect(parseCondition(id)).toBe(expected);
  });

  it('returns Unknown for unrecognised IDs', () => {
    expect(parseCondition('9999')).toBe('Unknown');
    expect(parseCondition('')).toBe('Unknown');
    expect(parseCondition(undefined)).toBe('Unknown');
  });
});

describe('extractCardInfo', () => {
  const base = {
    itemId: 'item-001',
    title: 'Charizard Holo PSA 10',
    price: { value: '120.50' },
    condition: '3000',
  };

  it('extracts id, name, price, and condition', () => {
    const result = extractCardInfo(base);
    expect(result.id).toBe('item-001');
    expect(result.name).toBe('Charizard Holo PSA 10');
    expect(result.price).toBe(120.5);
    expect(result.condition).toBe('New');
    expect(result.quantity).toBe(1);
  });

  it('defaults price to 0 when missing', () => {
    expect(extractCardInfo({ ...base, price: undefined }).price).toBe(0);
  });

  it('defaults condition to New when missing', () => {
    expect(extractCardInfo({ ...base, condition: undefined }).condition).toBe('New');
  });
});

describe('aggregateCardData', () => {
  it('returns empty array for no items', () => {
    expect(aggregateCardData([])).toEqual([]);
  });

  it('groups items with the same name+condition into one card', () => {
    const items = [
      { itemId: '1', title: 'Pikachu', price: { value: '10' }, condition: '3000' },
      { itemId: '2', title: 'Pikachu', price: { value: '20' }, condition: '3000' },
    ];
    const [card] = aggregateCardData(items);
    expect(card.salesCount).toBe(2);
    expect(card.priceHistory).toHaveLength(2);
    expect(card.recentPrice).toBe(20);
  });

  it('keeps cards with different conditions as separate entries', () => {
    const items = [
      { itemId: '1', title: 'Pikachu', price: { value: '10' }, condition: '3000' },
      { itemId: '2', title: 'Pikachu', price: { value: '5' }, condition: '4000' },
    ];
    expect(aggregateCardData(items)).toHaveLength(2);
  });

  it('identifies collection from card name (case-insensitive)', () => {
    const items = [{ itemId: '1', title: 'Pokemon Charizard', price: { value: '50' }, condition: '3000' }];
    expect(aggregateCardData(items)[0].collection).toBe('Pokemon');
  });

  it('falls back to Unknown when no collection matches', () => {
    const items = [{ itemId: '1', title: 'Rare Mystery Card', price: { value: '5' }, condition: '3000' }];
    expect(aggregateCardData(items)[0].collection).toBe('Unknown');
  });

  it('sorts priceHistory chronologically', () => {
    const items = [
      { itemId: '2', title: 'Mewtwo', price: { value: '30' }, condition: '3000' },
      { itemId: '1', title: 'Mewtwo', price: { value: '10' }, condition: '3000' },
    ];
    const [card] = aggregateCardData(items);
    const dates = card.priceHistory.map(p => p.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe('calculateStats', () => {
  it('returns zeros for empty card list', () => {
    const stats = calculateStats([]);
    expect(stats.avgPrice).toBe(0);
    expect(stats.highestSale).toBe(0);
    expect(stats.lowestSale).toBe(0);
    expect(stats.totalVolume).toBe(0);
    expect(stats.priceChangePercent).toBe(0);
  });

  it('calculates average, highest, lowest, and total volume', () => {
    const cards = [
      { priceHistory: [{ price: 10 }, { price: 20 }, { price: 30 }] },
    ];
    const stats = calculateStats(cards);
    expect(stats.avgPrice).toBe(20);
    expect(stats.highestSale).toBe(30);
    expect(stats.lowestSale).toBe(10);
    expect(stats.totalVolume).toBe(3);
  });

  it('calculates price change percent (oldest → newest)', () => {
    const cards = [
      { priceHistory: [{ price: 100 }, { price: 110 }] },
    ];
    // (110 - 100) / 100 * 100 = 10%
    expect(calculateStats(cards).priceChangePercent).toBe(10);
  });

  it('returns 0 price change when oldest price is 0', () => {
    const cards = [{ priceHistory: [{ price: 0 }, { price: 50 }] }];
    expect(calculateStats(cards).priceChangePercent).toBe(0);
  });
});
