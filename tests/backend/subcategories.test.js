import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { admin: {} } }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));

import subcatsRouter from '../../src/routes/subcategories.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', subcatsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

const PARENT = { id: 'cat-1', name: 'Pokemon' };
const SUB = { id: 'sub-1', name: 'Vintage', description: 'Old cards', parent_id: 'cat-1', created_at: '2026-01-01T00:00:00Z' };

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
  it('returns paginated subcategories', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [SUB], error: null, count: 1 }));
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.subcategories).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('defaults to page 1 and limit 50', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(50);
  });

  it('clamps limit to 200', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/?limit=999');
    expect(res.body.limit).toBe(200);
  });

  it('filters by parentId when provided', async () => {
    const b = makeBuilder({ data: [], error: null, count: 0 });
    mockSupabase.from.mockReturnValue(b);
    await request(app).get('/?parentId=cat-1');
    expect(b.eq).toHaveBeenCalledWith('parent_id', 'cat-1');
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns a single subcategory', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: SUB, error: null }));
    const res = await request(app).get('/sub-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sub-1');
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
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/').send({ parentId: 'cat-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when parentId is missing', async () => {
    const res = await request(app).post('/').send({ name: 'Vintage' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parentId is required/i);
  });

  it('returns 404 when parent category does not exist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).post('/').send({ name: 'Vintage', parentId: 'bad-cat' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/parent category not found/i);
  });

  it('returns 409 when subcategory name already exists under this parent', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: PARENT, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: { id: 'sub-1' }, error: null }));
    const res = await request(app).post('/').send({ name: 'Vintage', parentId: 'cat-1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('creates a subcategory and returns 201', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: PARENT, error: null }))    // parent check
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))      // duplicate check
      .mockReturnValueOnce(makeBuilder({ data: SUB, error: null }))       // insert
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));     // audit
    const res = await request(app).post('/').send({ name: 'Vintage', parentId: 'cat-1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sub-1');
  });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

describe('PATCH /:id', () => {
  it('updates and returns the subcategory', async () => {
    const updated = { ...SUB, name: 'Modern' };
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: { id: 'sub-1' }, error: null }))   // fetch check
      .mockReturnValueOnce(makeBuilder({ data: updated, error: null }))            // update
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));              // audit
    const res = await request(app).patch('/sub-1').send({ name: 'Modern' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Modern');
  });

  it('returns 404 when subcategory does not exist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).patch('/nonexistent').send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /:id', () => {
  it('deletes and returns success', async () => {
    mockSupabase.from
      .mockReturnValueOnce(makeBuilder({ data: SUB, error: null }))       // fetch
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))      // delete
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }));     // audit
    const res = await request(app).delete('/sub-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when subcategory does not exist', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).delete('/nonexistent');
    expect(res.status).toBe(404);
  });
});
