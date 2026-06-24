import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/middleware/auth.js', () => ({
  optionalAuthMiddleware: (req, _res, next) => { if (req.headers.authorization) req.user = { id: 'user-1' }; next(); },
}));

import recommendationsRouter from '../../src/routes/recommendations.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', recommendationsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: [], error: null }) {
  const b = {
    select: vi.fn(() => b), eq: vi.fn(() => b), neq: vi.fn(() => b),
    in: vi.fn(() => b), order: vi.fn(() => b), limit: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));
const auth = (req) => req.set('Authorization', 'Bearer token');

beforeEach(() => vi.clearAllMocks());

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET / (recommendations)', () => {
  it('returns popular listings for anonymous users', async () => {
    queueFrom(makeBuilder({ data: [{ id: 'l1' }, { id: 'l2' }], error: null }));
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('popular');
    expect(res.body.recommendations).toHaveLength(2);
  });

  it('returns personalized recommendations from user interests', async () => {
    queueFrom(
      makeBuilder({ data: [{ item_id: 'i1', item_type: 'pokemon' }], error: null }), // wishlist
      makeBuilder({ data: [{ item_id: 'i2', item_type: 'sports' }], error: null }),  // orders
      makeBuilder({ data: [{ id: 'rec1' }], error: null }),                          // similar
    );
    const res = await auth(request(app).get('/'));
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('personalized');
    expect(res.body.recommendations).toEqual([{ id: 'rec1' }]);
  });

  it('falls back to popular listings when interests yield no matches', async () => {
    queueFrom(
      makeBuilder({ data: [{ item_id: 'i1', item_type: 'pokemon' }], error: null }), // wishlist
      makeBuilder({ data: [], error: null }),                                        // orders
      makeBuilder({ data: [], error: null }),                                        // similar (empty)
      makeBuilder({ data: [{ id: 'pop1' }], error: null }),                          // popular fallback
    );
    const res = await auth(request(app).get('/'));
    expect(res.body.type).toBe('personalized'); // had interests, even if fallback content
    expect(res.body.recommendations).toEqual([{ id: 'pop1' }]);
  });

  it('returns popular type when the user has no interests', async () => {
    queueFrom(
      makeBuilder({ data: [], error: null }), // wishlist empty
      makeBuilder({ data: [], error: null }), // orders empty
      makeBuilder({ data: [{ id: 'pop1' }], error: null }), // popular
    );
    const res = await auth(request(app).get('/'));
    expect(res.body.type).toBe('popular');
  });

  it('returns 500 on a query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /similar/:itemId ─────────────────────────────────────────────────────

describe('GET /similar/:itemId', () => {
  it('returns items in the same category', async () => {
    queueFrom(
      makeBuilder({ data: { category: 'pokemon' }, error: null }), // item lookup
      makeBuilder({ data: [{ id: 's1' }, { id: 's2' }], error: null }), // similar
    );
    const res = await request(app).get('/similar/item-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns 404 when the item does not exist', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).get('/similar/missing');
    expect(res.status).toBe(404);
  });

  it('returns popular items when the item has no category', async () => {
    queueFrom(
      makeBuilder({ data: { category: null, vault_item: null }, error: null }), // item w/o category
      makeBuilder({ data: [{ id: 'pop1' }], error: null }),                     // popular
    );
    const res = await request(app).get('/similar/item-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'pop1' }]);
  });

  it('returns 500 on a query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/similar/item-1');
    expect(res.status).toBe(500);
  });
});
