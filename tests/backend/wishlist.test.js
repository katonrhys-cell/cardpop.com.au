import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// optionalAuthMiddleware: populate req.user only when an Authorization header is present.
vi.mock('../../src/middleware/auth.js', () => ({
  optionalAuthMiddleware: (req, _res, next) => {
    if (req.headers.authorization) req.user = { id: 'user-1' };
    next();
  },
}));

import wishlistRouter from '../../src/routes/wishlist.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', wishlistRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// Chainable Supabase query-builder stub. Every chain method returns `this`;
// awaiting the builder (or calling .single()) resolves to `result`.
function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return b;
}

const auth = (req) => req.set('Authorization', 'Bearer test-token');

beforeEach(() => vi.clearAllMocks());

// ─── GET / ──────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(401);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns the wishlist for an authenticated user', async () => {
    const items = [{ id: 'w1', item_id: 'i1', item_type: 'vault_item' }];
    mockSupabase.from.mockReturnValue(makeBuilder({ data: items, error: null }));

    const res = await auth(request(app).get('/'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(items);
    expect(mockSupabase.from).toHaveBeenCalledWith('wishlists');
  });

  it('returns an empty array when there are no items', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await auth(request(app).get('/'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when the query errors', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await auth(request(app).get('/'));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to fetch/i);
  });
});

// ─── POST / ─────────────────────────────────────────────────────────────────

describe('POST /', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/').send({ item_id: 'i1', item_type: 'product' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await auth(request(app).post('/').send({ item_id: 'i1' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for an invalid item_type', async () => {
    const res = await auth(request(app).post('/').send({ item_id: 'i1', item_type: 'banana' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid item type/i);
  });

  it('returns 400 when the item is already in the wishlist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { id: 'w1' }, error: null }));
    const res = await auth(request(app).post('/').send({ item_id: 'i1', item_type: 'product' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already in wishlist/i);
  });

  it('creates the item and returns 201', async () => {
    const created = { id: 'w2', user_id: 'user-1', item_id: 'i1', item_type: 'product' };
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: null, error: null })) // existence check
      .mockReturnValueOnce(makeBuilder({ data: created, error: null })); // insert

    const res = await auth(request(app).post('/').send({ item_id: 'i1', item_type: 'product' }));
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
  });

  it('returns 500 when the insert errors', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: null, error: null })) // existence check
      .mockReturnValueOnce(makeBuilder({ data: null, error: new Error('insert failed') }));

    const res = await auth(request(app).post('/').send({ item_id: 'i1', item_type: 'listing' }));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to add/i);
  });
});

// ─── DELETE /:itemId ──────────────────────────────────────────────────────────

describe('DELETE /:itemId', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).delete('/w1');
    expect(res.status).toBe(401);
  });

  it('removes the item and returns 204', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ error: null }));
    const res = await auth(request(app).delete('/w1'));
    expect(res.status).toBe(204);
    expect(mockSupabase.from).toHaveBeenCalledWith('wishlists');
  });

  it('returns 500 when the delete errors', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ error: new Error('delete failed') }));
    const res = await auth(request(app).delete('/w1'));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to remove/i);
  });
});

// ─── GET /check/:itemId/:itemType ──────────────────────────────────────────────

describe('GET /check/:itemId/:itemType', () => {
  it('returns inWishlist:false for an anonymous user without querying', async () => {
    const res = await request(app).get('/check/i1/product');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inWishlist: false });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns inWishlist:true when the item exists', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { id: 'w1' }, error: null }));
    const res = await auth(request(app).get('/check/i1/product'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inWishlist: true });
  });

  it('returns inWishlist:false when the item does not exist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await auth(request(app).get('/check/i1/product'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inWishlist: false });
  });

  it('degrades to inWishlist:false when the query throws', async () => {
    mockSupabase.from.mockImplementation(() => { throw new Error('boom'); });
    const res = await auth(request(app).get('/check/i1/product'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inWishlist: false });
  });
});
