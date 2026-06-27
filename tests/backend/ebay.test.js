import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const {
  mockCallEbayApi,
  mockGetMarketData,
  mockGetCardDetails,
  mockGetSalesData,
  mockGetStatistics,
  mockEbayCache,
  mockLogger,
  mockPopularCards,
} = vi.hoisted(() => ({
  mockCallEbayApi: vi.fn(),
  mockGetMarketData: vi.fn().mockResolvedValue({}),
  mockGetCardDetails: vi.fn().mockResolvedValue({}),
  mockGetSalesData: vi.fn().mockResolvedValue({ sales: [] }),
  mockGetStatistics: vi.fn().mockResolvedValue({}),
  mockEbayCache: { get: vi.fn().mockReturnValue(null), set: vi.fn(), clear: vi.fn() },
  mockLogger: { default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
  mockPopularCards: [{ name: 'Charizard', set: 'Base Set' }],
}));

vi.mock('../../src/utils/ebayClient.js', () => ({ callEbayApi: mockCallEbayApi }));
vi.mock('../../src/utils/ebayMarketData.js', () => ({
  getMarketData: mockGetMarketData,
  getCardDetails: mockGetCardDetails,
}));
vi.mock('../../src/utils/ebaySalesStats.js', () => ({
  getSalesData: mockGetSalesData,
  getStatistics: mockGetStatistics,
}));
vi.mock('../../src/utils/ebayPopularCards.js', () => ({
  POPULAR_CARDS: mockPopularCards,
}));
vi.mock('../../src/utils/ebayCache.js', () => mockEbayCache);
vi.mock('../../src/utils/logger.js', () => mockLogger);

import ebayRouter from '../../src/routes/ebay.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', ebayRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

beforeEach(() => vi.clearAllMocks());

// ─── GET /search ──────────────────────────────────────────────────────────────

describe('GET /search', () => {
  it('returns 400 when cardName is missing', async () => {
    const res = await request(app).get('/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cardName/i);
  });

  it('returns 400 when cardName is whitespace only', async () => {
    const res = await request(app).get('/search?cardName=%20');
    expect(res.status).toBe(400);
  });

  it('returns listing array on success', async () => {
    mockCallEbayApi.mockResolvedValue({
      itemSummaries: [
        {
          itemId: 'item-1',
          title: 'Charizard Holo',
          price: { value: '120.50' },
          condition: '3000',
          seller: { username: 'seller1', feedbackPercentage: '99.5', feedbackScore: 500 },
          itemWebUrl: 'https://ebay.com/item/1',
          image: { imageUrl: 'https://img.ebay.com/1.jpg' },
        },
      ],
    });
    const res = await request(app).get('/search?cardName=Charizard');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].itemId).toBe('item-1');
    expect(res.body[0].price).toBe(120.5);
  });

  it('clamps limit to 200', async () => {
    mockCallEbayApi.mockResolvedValue({ itemSummaries: [] });
    await request(app).get('/search?cardName=Pikachu&limit=9999');
    const url = mockCallEbayApi.mock.calls[0][0];
    expect(url).toContain('limit=200');
  });

  it('defaults limit to 20', async () => {
    mockCallEbayApi.mockResolvedValue({ itemSummaries: [] });
    await request(app).get('/search?cardName=Pikachu');
    const url = mockCallEbayApi.mock.calls[0][0];
    expect(url).toContain('limit=20');
  });

  it('returns an empty array when eBay returns no itemSummaries', async () => {
    mockCallEbayApi.mockResolvedValue({});
    const res = await request(app).get('/search?cardName=Pikachu');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 502 when the eBay API throws', async () => {
    mockCallEbayApi.mockRejectedValue(new Error('upstream error'));
    const res = await request(app).get('/search?cardName=Pikachu');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/ebay api unavailable/i);
  });
});

// ─── GET /price-estimate ──────────────────────────────────────────────────────

describe('GET /price-estimate', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).get('/price-estimate');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns price statistics on success', async () => {
    mockCallEbayApi.mockImplementationOnce(async () => ({
      itemSummaries: [
        { itemId: 'i1', title: 'Card A', price: { value: '100' }, condition: '3000', itemWebUrl: '', image: {} },
        { itemId: 'i2', title: 'Card B', price: { value: '200' }, condition: '3000', itemWebUrl: '', image: {} },
      ],
    })).mockImplementationOnce(async () => ({
      itemSummaries: [],
    }));
    const res = await request(app).get('/price-estimate?name=Charizard');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.avgPrice).toBe(150);
    expect(res.body.minPrice).toBe(100);
    expect(res.body.maxPrice).toBe(200);
  });

  it('returns zeros when eBay returns no results', async () => {
    mockCallEbayApi.mockResolvedValue({ itemSummaries: [] });
    const res = await request(app).get('/price-estimate?name=Charizard');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.avgPrice).toBe(0);
    expect(res.body.minPrice).toBe(0);
    expect(res.body.maxPrice).toBe(0);
  });

  it('includes set and gradingService in the query when provided', async () => {
    mockCallEbayApi.mockResolvedValue({ itemSummaries: [] });
    await request(app).get('/price-estimate?name=Charizard&set=Base+Set&gradingService=PSA&gradeScore=10');
    const url = mockCallEbayApi.mock.calls[0][0];
    expect(url).toContain('Charizard');
    expect(url).toContain('Base+Set');
    expect(url).toContain('PSA');
    expect(url).toContain('10');
  });

  it('returns 502 when the eBay API throws', async () => {
    mockCallEbayApi.mockRejectedValueOnce(new Error('timeout')).mockRejectedValueOnce(new Error('timeout'));
    const res = await request(app).get('/price-estimate?name=Charizard');
    expect(res.status).toBe(502);
  });
});

// ─── GET /popular-cards ───────────────────────────────────────────────────────

describe('GET /popular-cards', () => {
  it('returns the popular cards list', async () => {
    const res = await request(app).get('/popular-cards');
    expect(res.status).toBe(200);
    // The endpoint returns the POPULAR_CARDS constant (mocked to one entry)
    expect(Array.isArray(res.body)).toBe(true);
  });
});
