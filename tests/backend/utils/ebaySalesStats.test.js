import { describe, it, expect } from 'vitest';
import {
  getDateRangeMs,
  filterSalesByDateRange,
  filterSalesByCollection,
  filterSalesByPrice,
  filterSalesByCondition,
  buildSalesResponse,
  calculateStatistics,
} from '../../../src/utils/ebaySalesStats.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeCard({ name = 'Card', collection = 'Pokemon', price = 10, condition = 'New', daysAgo = 1 } = {}) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    name,
    collection,
    recentPrice: price,
    condition,
    lastSaleDate: date.split('T')[0],
    priceHistory: [{ date, price }],
  };
}

// ─── getDateRangeMs ────────────────────────────────────────────────────────────

describe('getDateRangeMs', () => {
  it.each([
    ['24h', 24 * 60 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
    ['30d', 30 * 24 * 60 * 60 * 1000],
    ['90d', 90 * 24 * 60 * 60 * 1000],
    ['1y', 365 * 24 * 60 * 60 * 1000],
    ['all-time', Infinity],
  ])('%s → %s ms', (range, expected) => {
    expect(getDateRangeMs(range)).toBe(expected);
  });

  it('defaults to 7d for unknown ranges', () => {
    expect(getDateRangeMs('unknown')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(getDateRangeMs(undefined)).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ─── filterSalesByDateRange ────────────────────────────────────────────────────

describe('filterSalesByDateRange', () => {
  it('returns all cards for Infinity (all-time)', () => {
    const cards = [makeCard({ daysAgo: 1 }), makeCard({ daysAgo: 1000 })];
    expect(filterSalesByDateRange(cards, Infinity)).toHaveLength(2);
  });

  it('keeps only cards with price history within the window', () => {
    const cards = [makeCard({ daysAgo: 1 }), makeCard({ daysAgo: 10 }), makeCard({ daysAgo: 100 })];
    const result = filterSalesByDateRange(cards, 7 * 24 * 60 * 60 * 1000);
    expect(result).toHaveLength(1);
  });

  it('removes cards whose entire history is outside the window', () => {
    const result = filterSalesByDateRange([makeCard({ daysAgo: 90 })], 7 * 24 * 60 * 60 * 1000);
    expect(result).toHaveLength(0);
  });

  it('strips old entries but keeps the card if any entry is within window', () => {
    const card = {
      ...makeCard({ daysAgo: 1 }),
      priceHistory: [
        { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), price: 5 },
        { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), price: 10 },
      ],
    };
    const [result] = filterSalesByDateRange([card], 7 * 24 * 60 * 60 * 1000);
    expect(result.priceHistory).toHaveLength(1);
    expect(result.priceHistory[0].price).toBe(10);
  });
});

// ─── filterSalesByCollection ───────────────────────────────────────────────────

describe('filterSalesByCollection', () => {
  it('returns all cards when collection is undefined', () => {
    const cards = [makeCard({ collection: 'Pokemon' }), makeCard({ collection: 'Magic' })];
    expect(filterSalesByCollection(cards, undefined)).toHaveLength(2);
  });

  it('filters cards by collection (case-insensitive)', () => {
    const cards = [makeCard({ collection: 'Pokemon' }), makeCard({ collection: 'Magic' })];
    expect(filterSalesByCollection(cards, 'pokemon')).toHaveLength(1);
    expect(filterSalesByCollection(cards, 'MAGIC')).toHaveLength(1);
  });

  it('returns empty when no match', () => {
    const cards = [makeCard({ collection: 'Pokemon' })];
    expect(filterSalesByCollection(cards, 'Digimon')).toHaveLength(0);
  });
});

// ─── filterSalesByPrice ────────────────────────────────────────────────────────

describe('filterSalesByPrice', () => {
  const cards = [makeCard({ price: 5 }), makeCard({ price: 50 }), makeCard({ price: 500 })];

  it('filters by minimum price', () => {
    expect(filterSalesByPrice(cards, 50, undefined)).toHaveLength(2);
  });

  it('filters by maximum price', () => {
    expect(filterSalesByPrice(cards, undefined, 50)).toHaveLength(2);
  });

  it('filters by both min and max', () => {
    expect(filterSalesByPrice(cards, 10, 100)).toHaveLength(1);
  });

  it('returns all when neither bound is set', () => {
    expect(filterSalesByPrice(cards, undefined, undefined)).toHaveLength(3);
  });
});

// ─── filterSalesByCondition ────────────────────────────────────────────────────

describe('filterSalesByCondition', () => {
  const cards = [makeCard({ condition: 'New' }), makeCard({ condition: 'Used' })];

  it('returns all cards when condition is undefined', () => {
    expect(filterSalesByCondition(cards, undefined)).toHaveLength(2);
  });

  it('filters by condition (case-insensitive)', () => {
    expect(filterSalesByCondition(cards, 'new')).toHaveLength(1);
    expect(filterSalesByCondition(cards, 'USED')).toHaveLength(1);
  });
});

// ─── buildSalesResponse ───────────────────────────────────────────────────────

describe('buildSalesResponse', () => {
  const cards = Array.from({ length: 5 }, (_, i) => makeCard({ name: `Card ${i}`, price: i * 10 }));

  it('paginates correctly for page 1', () => {
    const result = buildSalesResponse(cards, 1, 3);
    expect(result.sales).toHaveLength(3);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(3);
  });

  it('paginates correctly for the last page', () => {
    const result = buildSalesResponse(cards, 2, 3);
    expect(result.sales).toHaveLength(2);
  });

  it('maps card fields to sale shape', () => {
    const [sale] = buildSalesResponse([makeCard({ name: 'Test Card', price: 99, collection: 'Pokemon' })], 1, 10).sales;
    expect(sale.cardName).toBe('Test Card');
    expect(sale.soldPrice).toBe(99);
    expect(sale.collectionType).toBe('Pokemon');
    expect(sale.sellerLocation).toBe('AU');
    expect(sale.ebayUrl).toMatch(/ebay\.com\.au/);
  });
});

// ─── calculateStatistics ──────────────────────────────────────────────────────

describe('calculateStatistics', () => {
  it('returns zero-value object for empty array', () => {
    const stats = calculateStatistics([]);
    expect(stats.totalSalesVolume).toBe(0);
    expect(stats.totalSalesValue).toBe(0);
    expect(stats.averagePrice).toBe(0);
    expect(stats.medianPrice).toBe(0);
    expect(stats.highestSale.price).toBe(0);
    expect(stats.lowestSale.price).toBe(0);
    expect(stats.byCollection).toEqual([]);
  });

  it('calculates average, total value, and volume', () => {
    const cards = [
      makeCard({ price: 10 }),
      makeCard({ price: 20 }),
      makeCard({ price: 30 }),
    ];
    const stats = calculateStatistics(cards);
    expect(stats.totalSalesVolume).toBe(3);
    expect(stats.totalSalesValue).toBe(60);
    expect(stats.averagePrice).toBe(20);
  });

  it('calculates median for odd-length price list', () => {
    // prices [10, 20, 30] → sorted [10, 20, 30] → median = 20
    const cards = [makeCard({ price: 30 }), makeCard({ price: 10 }), makeCard({ price: 20 })];
    expect(calculateStatistics(cards).medianPrice).toBe(20);
  });

  it('calculates median for even-length price list', () => {
    // prices [10, 20] → sorted [10, 20] → median = (10 + 20) / 2 = 15
    const cards = [makeCard({ price: 10 }), makeCard({ price: 20 })];
    expect(calculateStatistics(cards).medianPrice).toBe(15);
  });

  it('identifies the card with the highest and lowest sale price', () => {
    const cards = [
      makeCard({ name: 'Cheap', price: 1 }),
      makeCard({ name: 'Expensive', price: 999 }),
    ];
    const stats = calculateStatistics(cards);
    expect(stats.highestSale.cardName).toBe('Expensive');
    expect(stats.lowestSale.cardName).toBe('Cheap');
  });

  it('groups sales by collection', () => {
    const cards = [
      makeCard({ collection: 'Pokemon', price: 10 }),
      makeCard({ collection: 'Pokemon', price: 20 }),
      makeCard({ collection: 'Magic', price: 50 }),
    ];
    const stats = calculateStatistics(cards);
    const pokemon = stats.byCollection.find(c => c.name === 'Pokemon');
    const magic = stats.byCollection.find(c => c.name === 'Magic');
    expect(pokemon.salesCount).toBe(2);
    expect(pokemon.avgPrice).toBe(15);
    expect(magic.salesCount).toBe(1);
  });

  it('excludes collections with zero sales from byCollection', () => {
    const cards = [makeCard({ collection: 'Pokemon', price: 10 })];
    const stats = calculateStatistics(cards);
    expect(stats.byCollection.every(c => c.salesCount > 0)).toBe(true);
  });
});
