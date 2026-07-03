import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockCallEbayApi = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/ebayClient.js', () => ({
  callEbayApi: mockCallEbayApi,
  getAccessToken: vi.fn(),
}));
vi.mock('../../src/utils/exchangeRates.js', () => ({
  getUsdToAudRate: vi.fn().mockResolvedValue(1.5),
}));

import pricesRouter from '../../src/routes/prices.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', pricesRouter);
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {};
  for (const m of ['select', 'insert', 'upsert', 'eq', 'neq', 'order', 'limit']) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.single = vi.fn(() => Promise.resolve(result));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

// Route/util code fetches from tables in a deterministic per-table order, so
// queue builders per table name.
let queues;
beforeEach(() => {
  vi.clearAllMocks();
  queues = { tracked_cards: [], card_price_snapshots: [] };
  mockSupabase.from.mockImplementation((table) => {
    const next = queues[table]?.shift();
    if (!next) throw new Error(`Unexpected query on table "${table}"`);
    return next;
  });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

const ebayResult = {
  itemSummaries: [
    { title: 'Card raw near mint', price: { value: '100.00' }, itemWebUrl: 'https://ebay/1', image: { imageUrl: 'https://img/1' } },
    { title: 'Card PSA 10 GEM MINT', price: { value: '500.00' }, itemWebUrl: 'https://ebay/2', image: { imageUrl: 'https://img/2' } },
  ],
};

// ─── GET /refresh ────────────────────────────────────────────────────────────

describe('GET /refresh', () => {
  it('rejects calls without the cron secret when one is configured', async () => {
    process.env.CRON_SECRET = 'supersecret';
    const res = await request(app).get('/refresh');
    expect(res.status).toBe(401);
  });

  it('accepts the cron call with the right bearer token and refreshes pending cards', async () => {
    process.env.CRON_SECRET = 'supersecret';
    mockCallEbayApi.mockResolvedValue(ebayResult);

    const upsertBuilder = makeBuilder({ data: { id: 'snap-1' }, error: null });
    queues.tracked_cards.push(makeBuilder({ data: [{ id: 'c1', slug: 'test-card', search_query: 'test card' }], error: null }));
    queues.card_price_snapshots.push(makeBuilder({ data: [], error: null })); // nothing snapshotted today
    queues.card_price_snapshots.push(upsertBuilder);

    const res = await request(app).get('/refresh').set('Authorization', 'Bearer supersecret');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, alreadyFresh: 0, refreshed: 1, failed: 0, remaining: 0 });

    // The snapshot separates raw and graded listings and converts US prices to AUD.
    const payload = upsertBuilder.upsert.mock.calls[0][0];
    expect(payload.card_id).toBe('c1');
    // 1 raw AU listing @ 100 + 1 raw US listing @ 100 * 1.5
    expect(payload.raw_count).toBe(2);
    expect(payload.raw_min).toBe(100);
    expect(payload.raw_max).toBe(150);
    // 1 graded AU @ 500 + 1 graded US @ 500 * 1.5
    expect(payload.graded_count).toBe(2);
    expect(payload.graded_min).toBe(500);
    expect(payload.graded_max).toBe(750);
    expect(payload.exchange_rate).toBe(1.5);
    expect(payload.sample_listings.length).toBeGreaterThan(0);
  });

  it('skips cards that already have a snapshot today', async () => {
    queues.tracked_cards.push(makeBuilder({ data: [{ id: 'c1', slug: 'test-card', search_query: 'q' }], error: null }));
    queues.card_price_snapshots.push(makeBuilder({ data: [{ card_id: 'c1' }], error: null }));

    const res = await request(app).get('/refresh');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, alreadyFresh: 1, refreshed: 0 });
    expect(mockCallEbayApi).not.toHaveBeenCalled();
  });

  it('counts a card as failed when both eBay marketplaces are down', async () => {
    mockCallEbayApi.mockRejectedValue(new Error('eBay down'));
    queues.tracked_cards.push(makeBuilder({ data: [{ id: 'c1', slug: 'test-card', search_query: 'q' }], error: null }));
    queues.card_price_snapshots.push(makeBuilder({ data: [], error: null }));

    const res = await request(app).get('/refresh');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refreshed: 0, failed: 1 });
  });
});

// ─── POST /refresh-card ──────────────────────────────────────────────────────

describe('POST /refresh-card', () => {
  it('requires a slug', async () => {
    const res = await request(app).post('/refresh-card').send({});
    expect(res.status).toBe(400);
  });

  it('404s for an unknown or inactive card', async () => {
    queues.tracked_cards.push(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/refresh-card').send({ slug: 'nope' });
    expect(res.status).toBe(404);
  });

  it('is a no-op when today\'s snapshot already exists', async () => {
    queues.tracked_cards.push(makeBuilder({ data: { id: 'c1', slug: 'test-card', search_query: 'q' }, error: null }));
    queues.card_price_snapshots.push(makeBuilder({ data: { id: 'snap-1' }, error: null }));

    const res = await request(app).post('/refresh-card').send({ slug: 'test-card' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refreshed: false, snapshot: { id: 'snap-1' } });
    expect(mockCallEbayApi).not.toHaveBeenCalled();
  });

  it('builds a fresh snapshot when today\'s is missing', async () => {
    mockCallEbayApi.mockResolvedValue(ebayResult);
    queues.tracked_cards.push(makeBuilder({ data: { id: 'c1', slug: 'test-card', search_query: 'q' }, error: null }));
    queues.card_price_snapshots.push(makeBuilder({ data: null, error: null })); // no snapshot yet
    queues.card_price_snapshots.push(makeBuilder({ data: { id: 'snap-new' }, error: null }));

    const res = await request(app).post('/refresh-card').send({ slug: 'test-card' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refreshed: true, snapshot: { id: 'snap-new' } });
  });

  it('502s when eBay is entirely unavailable', async () => {
    mockCallEbayApi.mockRejectedValue(new Error('eBay down'));
    queues.tracked_cards.push(makeBuilder({ data: { id: 'c1', slug: 'test-card', search_query: 'q' }, error: null }));
    queues.card_price_snapshots.push(makeBuilder({ data: null, error: null }));

    const res = await request(app).post('/refresh-card').send({ slug: 'test-card' });
    expect(res.status).toBe(502);
  });
});
