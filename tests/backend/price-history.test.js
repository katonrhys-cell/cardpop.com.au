import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
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

import priceHistoryRouter from '../../src/routes/price-history.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', priceHistoryRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), insert: vi.fn(() => b), eq: vi.fn(() => b),
    ilike: vi.fn(() => b), gte: vi.fn(() => b), order: vi.fn(() => b), limit: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(false);
});

// ─── GET /:itemId ─────────────────────────────────────────────────────────────

describe('GET /:itemId', () => {
  it('computes stats over the price history', async () => {
    queueFrom(makeBuilder({ data: [
      { price: 10, recorded_at: '2026-01-01' },
      { price: 20, recorded_at: '2026-01-02' },
      { price: 15, recorded_at: '2026-01-03' },
    ], error: null }));

    const res = await request(app).get('/item-1');
    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      current: 15, highest: 20, lowest: 10, average: '15.00', change: '5.00', changePercent: '50.00',
    });
    expect(res.body.period).toBe('90 days');
    expect(res.body.history).toHaveLength(3);
  });

  it('returns null stats for an empty history', async () => {
    queueFrom(makeBuilder({ data: [], error: null }));
    const res = await request(app).get('/item-1');
    expect(res.body.stats).toMatchObject({ current: null, highest: null, change: null });
  });

  it('omits change figures when there is a single data point', async () => {
    queueFrom(makeBuilder({ data: [{ price: 12, recorded_at: 'x' }], error: null }));
    const res = await request(app).get('/item-1');
    expect(res.body.stats.current).toBe(12);
    expect(res.body.stats.change).toBeNull();
  });

  it('respects a custom days period', async () => {
    queueFrom(makeBuilder({ data: [], error: null }));
    const res = await request(app).get('/item-1?days=30');
    expect(res.body.period).toBe('30 days');
  });

  it('returns 500 on a query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/item-1');
    expect(res.status).toBe(500);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  it('rejects non-admin callers with 403', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).post('/').send({ item_id: 'i', item_type: 'vault_item', price: 10 });
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const res = await request(app).post('/').send({ item_id: 'i' });
    expect(res.status).toBe(400);
  });

  it('records a price point for an admin', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const created = { id: 'p1', item_id: 'i', price: 10.5 };
    queueFrom(makeBuilder({ data: created, error: null }));
    const res = await request(app).post('/').send({ item_id: 'i', item_type: 'vault_item', price: '10.5' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
  });

  it('returns 500 when the insert fails', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    queueFrom(makeBuilder({ data: null, error: new Error('insert failed') }));
    const res = await request(app).post('/').send({ item_id: 'i', item_type: 'vault_item', price: 10 });
    expect(res.status).toBe(500);
  });
});

// ─── GET /market/:cardName ────────────────────────────────────────────────────

describe('GET /market/:cardName', () => {
  it('aggregates listing prices alongside market data', async () => {
    queueFrom(
      makeBuilder({ data: [{ source: 'ebay', recorded_at: 'x' }], error: null }), // market_data
      makeBuilder({ data: [{ price_aud: 100 }, { price_aud: 200 }, { price_aud: 300 }], error: null }), // listings
    );
    const res = await request(app).get('/market/Charizard');
    expect(res.status).toBe(200);
    expect(res.body.averageListingPrice).toBe('200.00');
    expect(res.body.lowestListingPrice).toBe(100);
    expect(res.body.highestListingPrice).toBe(300);
    expect(res.body.marketData).toHaveLength(1);
  });

  it('returns 500 on a market query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/market/Charizard');
    expect(res.status).toBe(500);
  });
});
