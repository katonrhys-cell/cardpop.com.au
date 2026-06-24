import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

// queries: keyed by `${table}` or `${table}:${sourceFilter}` → { data, error }
// upserts: records every upsert({ table, payload, opts })
const h = vi.hoisted(() => ({ queries: {}, upserts: [], upsertError: null }));

vi.mock('../../../src/utils/supabaseClient.js', () => {
  function makeBuilder(table) {
    const filters = {};
    const resolveQuery = () => {
      const key = filters.source ? `${table}:${filters.source}` : table;
      return h.queries[key] ?? { data: null, error: null };
    };
    const b = {
      select: () => b,
      eq: (col, val) => { filters[col] = val; return b; },
      neq: () => b, gte: () => b, lte: () => b, not: () => b,
      order: () => b, limit: () => b,
      maybeSingle: () => Promise.resolve(resolveQuery()),
      single: () => Promise.resolve(resolveQuery()),
      upsert: (payload, opts) => {
        h.upserts.push({ table, payload, opts });
        return Promise.resolve({ error: h.upsertError });
      },
      then: (resolve, reject) => Promise.resolve(resolveQuery()).then(resolve, reject),
    };
    return b;
  }
  const supabase = { from: vi.fn((t) => makeBuilder(t)) };
  return { default: supabase, supabase };
});

const mockGetClient = vi.hoisted(() => vi.fn());
const mockSummarise = vi.hoisted(() => vi.fn());
const mockCallEbay = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/cardSightClient.js', () => ({
  getCardSightClient: mockGetClient,
  summarisePricingAud: mockSummarise,
}));
vi.mock('../../../src/utils/ebayClient.js', () => ({ callEbayApi: mockCallEbay }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  refreshCardMarketData, computePriceRange, getPriceRange, getStoredMarketData,
} from '../../../src/utils/marketDataService.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.queries = {};
  h.upserts = [];
  h.upsertError = null;
});

const upsertsTo = (table) => h.upserts.filter((u) => u.table === table);

// ─── computePriceRange ───────────────────────────────────────────────────────

describe('computePriceRange', () => {
  it('returns null and writes nothing when there is no price data', async () => {
    const result = await computePriceRange('card-1', 'Charizard', 'Base');
    expect(result).toBeNull();
    expect(upsertsTo('card_price_ranges')).toHaveLength(0);
  });

  it('aggregates all sources into a low/avg/high/floor range and persists it', async () => {
    h.queries = {
      'card_market_valuations:cardsight': { data: { raw_data: { minPrice: 10, avgPrice: 20, maxPrice: 30, lastSalePrice: 25 } } },
      'card_market_valuations:ebay_au': { data: { raw_data: { minPrice: 12, avgPrice: 22, maxPrice: 32 } } },
      completed_sales: { data: [{ sale_price: 18 }] },
      market_sold_listings: { data: [{ sold_price_aud: 28 }] },
    };

    const result = await computePriceRange('card-1', 'Charizard', 'Base');
    // sorted valid prices: [10,12,18,20,22,25,28,30,32] (n=9)
    expect(result.lowAud).toBe(12);   // 20th percentile index = floor(0.2*8)=1 → 12
    expect(result.highAud).toBe(28);  // 80th percentile index = floor(0.8*8)=6 → 28
    expect(result.avgAud).toBe(21.89); // 197/9 rounded
    expect(result.floorAud).toBe(6);  // low * 0.5
    expect(result.sourcesUsed).toEqual(expect.arrayContaining(['cardsight', 'ebay_au', 'cardpop']));

    const [upsert] = upsertsTo('card_price_ranges');
    expect(upsert.payload).toMatchObject({ card_id: 'card-1', low_aud: 12, high_aud: 28, floor_aud: 6, source_count: 9 });
    expect(upsert.opts).toEqual({ onConflict: 'card_id' });
  });

  it('uses the spread fallback when a valuation has only market_value', async () => {
    h.queries = {
      'card_market_valuations:cardsight': { data: { market_value: 100 } }, // → 75, 100, 125
      'card_market_valuations:ebay_au': { data: null },
    };
    const result = await computePriceRange('card-2');
    // valid sorted: [75,100,125] (n=3); avg = 100.
    // pct(0.2) → index floor(0.2*2)=0 → 75; pct(0.8) → index floor(0.8*2)=1 → 100.
    expect(result.avgAud).toBe(100);
    expect(result.lowAud).toBe(75);
    expect(result.highAud).toBe(100);
    expect(result.floorAud).toBe(37.5); // low * 0.5
    expect(result.sourcesUsed).toEqual(['cardsight']);
  });
});

// ─── getPriceRange / getStoredMarketData ─────────────────────────────────────

describe('getPriceRange', () => {
  it('returns the stored range row', async () => {
    h.queries.card_price_ranges = { data: { card_id: 'c1', low_aud: 5, avg_aud: 10, high_aud: 15 } };
    expect(await getPriceRange('c1')).toMatchObject({ low_aud: 5, high_aud: 15 });
  });

  it('returns null when no range exists', async () => {
    expect(await getPriceRange('missing')).toBeNull();
  });
});

describe('getStoredMarketData', () => {
  it('keys valuations by source and returns recent sold listings', async () => {
    h.queries.card_market_valuations = { data: [
      { source: 'cardsight', market_value: 100 },
      { source: 'ebay_au', market_value: 90 },
    ] };
    h.queries.market_sold_listings = { data: [{ external_id: 'e1', sold_price_aud: 95 }] };

    const result = await getStoredMarketData('c1');
    expect(result.valuations.cardsight.market_value).toBe(100);
    expect(result.valuations.ebay_au.market_value).toBe(90);
    expect(result.soldListings).toHaveLength(1);
  });

  it('tolerates empty results', async () => {
    const result = await getStoredMarketData('c1');
    expect(result).toEqual({ valuations: {}, soldListings: [] });
  });
});

// ─── refreshCardMarketData ───────────────────────────────────────────────────

describe('refreshCardMarketData', () => {
  function cardSightClient({ pricing, pop } = {}) {
    return {
      pricing: { get: vi.fn().mockResolvedValue({ data: pricing ?? {} }) },
      population: { card: vi.fn().mockResolvedValue({ data: pop ?? null }) },
    };
  }

  it('persists CardSight and eBay valuations with confidence scores', async () => {
    mockGetClient.mockReturnValue(cardSightClient());
    mockSummarise.mockResolvedValue({ avgPrice: 200, salesCount: 50, currency: 'AUD' }); // → confidence 95
    mockCallEbay.mockResolvedValue({
      itemSummaries: [
        { itemId: 'i1', price: { value: '100' }, title: 'A' },
        { itemId: 'i2', price: { value: '120' }, title: 'B' },
      ],
    });

    const result = await refreshCardMarketData({ cardId: 'card-1', cardName: 'Charizard', setName: 'Base' });

    const valuationUpserts = upsertsTo('card_market_valuations');
    const cardsight = valuationUpserts.find((u) => u.payload.source === 'cardsight');
    expect(cardsight.payload).toMatchObject({ market_value: 200, confidence_score: 95 });

    const ebay = valuationUpserts.find((u) => u.payload.source === 'ebay_au');
    expect(ebay.payload.market_value).toBe(110); // (100+120)/2
    expect(ebay.payload.confidence_score).toBe(40); // 2 samples → 40

    // Individual sold listings persisted too.
    expect(upsertsTo('market_sold_listings')).toHaveLength(1);
    expect(result.cardsight).not.toBeNull();
    expect(result.ebay).toEqual({ avgPrice: 110, count: 2 });
  });

  it('is resilient when one source fails (allSettled)', async () => {
    mockGetClient.mockImplementation(() => { throw new Error('CardSight down'); });
    mockCallEbay.mockResolvedValue({ itemSummaries: [{ itemId: 'i1', price: { value: '50' } }] });

    const result = await refreshCardMarketData({ cardId: 'card-1', cardName: 'Pikachu' });
    expect(result.cardsight).toBeNull();          // failed source → null
    expect(result.ebay).toEqual({ avgPrice: 50, count: 1 });
  });

  it('returns null eBay result when the search yields no priced items', async () => {
    mockGetClient.mockReturnValue(cardSightClient());
    mockSummarise.mockResolvedValue(null);
    mockCallEbay.mockResolvedValue({ itemSummaries: [] });

    const result = await refreshCardMarketData({ cardId: 'card-1', cardName: 'Obscure' });
    expect(result.ebay).toBeNull();
  });
});
