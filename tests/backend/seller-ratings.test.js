import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'reviewer-1' }; next(); },
  optionalAuthMiddleware: (req, _res, next) => { if (req.headers.authorization) req.user = { id: 'reviewer-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));

import sellerRatingsRouter from '../../src/routes/seller-ratings.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', sellerRatingsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// Chainable builder: chain methods return `this`; awaiting / single / maybeSingle
// resolves to `result`.
function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return b;
}

// Queue builders to be returned by successive from() calls, in order.
function queueFrom(...builders) {
  builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(false);
});

// ─── GET /:sellerId ───────────────────────────────────────────────────────────

describe('GET /:sellerId', () => {
  it('returns ratings, computed stats and performance', async () => {
    const ratings = [
      { rating: 5, comment: 'great', created_at: '2026-01-03' },
      { rating: 4, comment: 'good', created_at: '2026-01-02' },
      { rating: 5, comment: 'ace', created_at: '2026-01-01' },
    ];
    const seller = { response_time: '1h', successful_sales: 10, total_sales: 12 };
    queueFrom(
      makeBuilder({ data: ratings, error: null }),
      makeBuilder({ data: seller, error: null }),
    );

    const res = await request(app).get('/seller-9');
    expect(res.status).toBe(200);
    expect(res.body.ratings).toHaveLength(3);
    expect(res.body.stats.total).toBe(3);
    expect(res.body.stats.average).toBe('4.7'); // (5+4+5)/3 = 4.666 → 4.7
    expect(res.body.stats.distribution).toEqual({ 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 });
    expect(res.body.performance).toEqual(seller);
  });

  it('returns zeroed stats when the seller has no ratings', async () => {
    queueFrom(
      makeBuilder({ data: [], error: null }),
      makeBuilder({ data: null, error: { code: 'PGRST116' } }), // no profile row
    );

    const res = await request(app).get('/seller-9');
    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(0);
    expect(res.body.stats.average).toBe(0);
    expect(res.body.performance).toBeNull();
  });

  it('returns 500 when the ratings query errors', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/seller-9');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to fetch/i);
  });

  it('returns 500 when the profile query errors with a non-PGRST116 code', async () => {
    queueFrom(
      makeBuilder({ data: [], error: null }),
      makeBuilder({ data: null, error: { code: 'XX000', message: 'boom' } }),
    );
    const res = await request(app).get('/seller-9');
    expect(res.status).toBe(500);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  const valid = { seller_id: 'seller-9', rating: 5, order_id: 'order-1', comment: 'nice' };

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/').send({ rating: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when the rating is out of range', async () => {
    const res = await request(app).post('/').send({ ...valid, rating: 6 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when the rating is not an integer', async () => {
    const res = await request(app).post('/').send({ ...valid, rating: 4.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when a user tries to rate themselves', async () => {
    const res = await request(app).post('/').send({ ...valid, seller_id: 'reviewer-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot rate yourself/i);
  });

  it('returns 403 when the order does not belong to the reviewer/seller', async () => {
    queueFrom(makeBuilder({ data: { buyer_id: 'someone-else', seller_id: 'seller-9' }, error: null }));
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/your own completed orders/i);
  });

  it('returns 403 when the order does not exist', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(403);
  });

  it('returns 400 when the reviewer already rated this order', async () => {
    queueFrom(
      makeBuilder({ data: { buyer_id: 'reviewer-1', seller_id: 'seller-9' }, error: null }), // order
      makeBuilder({ data: { id: 'existing-rating' }, error: null }), // existing rating
    );
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already rated/i);
  });

  it('creates the rating, refreshes seller stats and returns 201', async () => {
    const created = { id: 'r-1', seller_id: 'seller-9', reviewer_id: 'reviewer-1', rating: 5 };
    const profileUpdate = makeBuilder({ data: null, error: null });
    queueFrom(
      makeBuilder({ data: { buyer_id: 'reviewer-1', seller_id: 'seller-9' }, error: null }), // order
      makeBuilder({ data: null, error: null }), // no existing rating
      makeBuilder({ data: created, error: null }), // insert
      makeBuilder({ data: [{ rating: 5 }, { rating: 4 }], error: null }), // updateSellerStats: read
      profileUpdate, // updateSellerStats: write
    );

    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
    // average of [5,4] = 4.5, reviews_count = 2
    expect(profileUpdate.update).toHaveBeenCalledWith({ rating: 4.5, reviews_count: 2 });
  });

  it('returns 500 when the order lookup errors', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(500);
  });

  it('returns 500 when the insert errors', async () => {
    queueFrom(
      makeBuilder({ data: { buyer_id: 'reviewer-1', seller_id: 'seller-9' }, error: null }),
      makeBuilder({ data: null, error: null }),
      makeBuilder({ data: null, error: new Error('insert failed') }),
    );
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:sellerId/performance ────────────────────────────────────────────────

describe('PUT /:sellerId/performance', () => {
  it('returns 403 for non-admin users', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).put('/seller-9/performance').send({ total_sales: 5 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin access required/i);
  });

  it('updates performance and returns the row for an admin', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const updated = { id: 'seller-9', response_time: '2h', successful_sales: 8, total_sales: 9 };
    queueFrom(makeBuilder({ data: updated, error: null }));

    const res = await request(app)
      .put('/seller-9/performance')
      .send({ response_time: '2h', successful_sales: 8, total_sales: 9 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
  });

  it('returns 500 when the update errors', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    queueFrom(makeBuilder({ data: null, error: new Error('update failed') }));
    const res = await request(app).put('/seller-9/performance').send({ total_sales: 5 });
    expect(res.status).toBe(500);
  });
});
