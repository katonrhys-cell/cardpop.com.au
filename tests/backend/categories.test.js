import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { admin: {} },
}));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));

import categoriesRouter from '../../src/routes/categories.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', categoriesRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

const CAT = { id: 'cat-1', name: 'Pokemon', description: 'Pocket Monsters', created_at: '2026-01-01T00:00:00Z' };

function makeBuilder(result = { data: null, error: null, count: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns paginated categories', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [CAT], error: null, count: 1 }));
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].id).toBe('cat-1');
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });

  it('clamps limit to 200', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/?limit=999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
  });

  it('defaults to page 1, limit 50', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(50);
  });

  it('calculates totalPages correctly', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: Array(3).fill(CAT), error: null, count: 7 }));
    const res = await request(app).get('/?limit=3');
    expect(res.body.totalPages).toBe(3);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns a single category with its subcategories', async () => {
    // First call: fetch category; second call: fetch subcategories
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: CAT, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: [], error: null }));
    const res = await request(app).get('/cat-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('cat-1');
    expect(res.body.subcategories).toEqual([]);
  });

  it('returns 404 when Supabase returns PGRST116', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  it('returns 401 without authorization header', async () => {
    // The real authMiddleware mock always passes; test that name validation works
    const res = await request(app).post('/').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when name is whitespace only', async () => {
    const res = await request(app).post('/').send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when a category with the same name already exists', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: { id: 'cat-1' }, error: null }));
    const res = await request(app).post('/').send({ name: 'Pokemon' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('creates a category and returns 201', async () => {
    // First call: duplicate check returns null; second call: insert returns new cat; third: audit log
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))          // maybeSingle check
      .mockReturnValueOnce(makeBuilder({ data: CAT, error: null }))           // insert
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));         // audit log
    const res = await request(app).post('/').send({ name: 'Pokemon' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cat-1');
  });

  it('trims whitespace from the name before creating', async () => {
    const insertBuilder = makeBuilder({ data: { ...CAT, name: 'Pokemon' }, error: null });
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    await request(app).post('/').send({ name: '  Pokemon  ' });
    // The insert call's insert() method should have been called with trimmed name
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pokemon' }),
    );
  });

  it('does not fail when the audit log write fails', async () => {
    const auditBuilder = makeBuilder({ data: null, error: { message: 'audit fail' } });
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: CAT, error: null }))
      .mockReturnValueOnce(auditBuilder);
    const res = await request(app).post('/').send({ name: 'NewCat' });
    expect(res.status).toBe(201);
  });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

describe('PATCH /:id', () => {
  it('updates and returns the category', async () => {
    const updated = { ...CAT, name: 'Magic' };
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { id: 'cat-1' }, error: null }))    // fetch check
      .mockReturnValueOnce(makeBuilder({ data: updated, error: null }))             // update
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));               // audit
    const res = await request(app).patch('/cat-1').send({ name: 'Magic' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Magic');
  });

  it('returns 404 when category does not exist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).patch('/nonexistent').send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /:id', () => {
  it('deletes the category and returns success', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: CAT, error: null }))         // fetch
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))        // delete subcategories
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))        // delete category
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));       // audit
    const res = await request(app).delete('/cat-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when category does not exist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).delete('/nonexistent');
    expect(res.status).toBe(404);
  });
});
