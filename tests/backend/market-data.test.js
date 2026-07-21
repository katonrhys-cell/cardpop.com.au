import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());
const mockGetRate = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/exchangeRates.js', () => ({ getUsdToAudRate: mockGetRate }));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  decodeAal: () => 'aal2',
  default: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/auth.js', () => ({
  optionalAuthMiddleware: (req, _res, next) => { if (req.headers.authorization) req.user = { id: 'u1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));

import marketDataRouter from '../../src/routes/market-data.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', marketDataRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: [], error: null }) {
  const b = {
    select: vi.fn(() => b), insert: vi.fn(() => b), eq: vi.fn(() => b),
    ilike: vi.fn(() => b), order: vi.fn(() => b), limit: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(false);
  mockGetRate.mockResolvedValue(1.5);
});

// ─── GET /:cardName ───────────────────────────────────────────────────────────

describe('GET /:cardName', () => {
  it('aggregates market data by source with the latest entry per source', async () => {
    queueFrom(makeBuilder({ data: [
      { source: 'ebay', market_price: 10, recorded_at: '2026-01-02' },
      { source: 'ebay', market_price: 12, recorded_at: '2026-01-01' },
      { source: 'tcgplayer', market_price: 20, recorded_at: '2026-01-03' },
    ], error: null }));

    const res = await request(app).get('/Charizard');
    expect(res.status).toBe(200);
    expect(res.body.sources).toEqual(expect.arrayContaining(['ebay', 'tcgplayer']));
    const ebay = res.body.data.find((d) => d.source === 'ebay');
    expect(ebay.prices).toHaveLength(2);
    expect(ebay.latest.recorded_at).toBe('2026-01-02'); // newest kept
  });

  it('returns 500 on a query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/Charizard');
    expect(res.status).toBe(500);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  it('rejects non-admins with 403', async () => {
    const res = await request(app).post('/').send({ card_name: 'C', source: 'ebay', market_price: 10 });
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const res = await request(app).post('/').send({ card_name: 'C' });
    expect(res.status).toBe(400);
  });

  it('records market data for an admin', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const created = { id: 'm1', card_name: 'C', source: 'ebay', market_price: 10.5 };
    queueFrom(makeBuilder({ data: created, error: null }));
    const res = await request(app).post('/').send({ card_name: 'C', source: 'ebay', market_price: '10.5' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
  });
});

// ─── GET /compare/:cardName ───────────────────────────────────────────────────

describe('GET /compare/:cardName', () => {
  it('averages the latest price per source and converts to AUD', async () => {
    queueFrom(makeBuilder({ data: [
      { source: 'ebay', market_price: 10, recorded_at: '2026-01-02' },
      { source: 'tcgplayer', market_price: 20, recorded_at: '2026-01-03' },
    ], error: null }));

    const res = await request(app).get('/compare/Charizard');
    expect(res.status).toBe(200);
    expect(res.body.averagePrice).toBe('15.00');          // (10 + 20) / 2
    expect(res.body.averagePriceAud).toBe('22.50');        // 15 * 1.5
    expect(res.body.sources).toEqual(expect.arrayContaining(['ebay', 'tcgplayer']));
  });

  it('returns null averages when there is no data', async () => {
    queueFrom(makeBuilder({ data: [], error: null }));
    const res = await request(app).get('/compare/Nothing');
    expect(res.body.averagePrice).toBeNull();
    expect(res.body.averagePriceAud).toBeNull();
  });
});

// ─── GET /trending/limit/:limit ───────────────────────────────────────────────

describe('GET /trending/limit/:limit', () => {
  it('groups by card, counts occurrences and sorts by frequency', async () => {
    queueFrom(makeBuilder({ data: [
      { card_name: 'Charizard', set_name: 'Base', market_price: 100, source: 'ebay', recorded_at: 'x' },
      { card_name: 'Charizard', set_name: 'Base', market_price: 120, source: 'tcg', recorded_at: 'y' },
      { card_name: 'Pikachu', set_name: 'Base', market_price: 10, source: 'ebay', recorded_at: 'z' },
    ], error: null }));

    const res = await request(app).get('/trending/limit/5');
    expect(res.status).toBe(200);
    expect(res.body[0].card_name).toBe('Charizard'); // appears twice → first
    expect(res.body[0].count).toBe(2);
    expect(res.body[0].avg_price).toBe('110.00');    // (100 + 120) / 2
    expect(res.body[0].sources).toEqual(expect.arrayContaining(['ebay', 'tcg']));
  });
});
