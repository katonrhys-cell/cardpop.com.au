import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockPb = vi.hoisted(() => ({ collection: vi.fn() }));

vi.mock('../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let mockUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = mockUser; next(); },
}));

import categoriesRouter from '../../src/routes/categories.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', categoriesRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── collection helpers ───────────────────────────────────────────────────────

const CAT = { id: 'cat-1', name: 'Pokemon', description: 'Pocket Monsters', icon: '', created: '2026-01-01T00:00:00Z', updated: '2026-01-02T00:00:00Z' };

function makeCollection(overrides = {}) {
  return {
    getFullList: vi.fn().mockResolvedValue([]),
    getList:     vi.fn().mockResolvedValue({ items: [] }),
    getOne:      vi.fn().mockResolvedValue(CAT),
    create:      vi.fn().mockResolvedValue(CAT),
    update:      vi.fn().mockResolvedValue(CAT),
    delete:      vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns paginated categories', async () => {
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue([CAT]),
      getList:     vi.fn().mockResolvedValue({ items: [CAT] }),
    });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].id).toBe('cat-1');
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });

  it('clamps limit to 100', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).get('/?limit=999');
    expect(col.getList.mock.calls[0][1]).toBe(100);
  });

  it('defaults to page 1, limit 20', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).get('/');
    expect(col.getList.mock.calls[0][0]).toBe(1);
    expect(col.getList.mock.calls[0][1]).toBe(20);
  });

  it('calculates totalPages correctly', async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ ...CAT, id: `cat-${i}` }));
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue(items),
      getList:     vi.fn().mockResolvedValue({ items: items.slice(0, 3) }),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).get('/?limit=3');
    expect(res.body.totalPages).toBe(3); // ceil(7/3)
  });

  it('maps description and icon with fallback to empty string', async () => {
    const noExtras = { ...CAT, description: undefined, icon: undefined };
    const col = makeCollection({
      getFullList: vi.fn().mockResolvedValue([noExtras]),
      getList:     vi.fn().mockResolvedValue({ items: [noExtras] }),
    });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).get('/');
    expect(res.body.categories[0].description).toBe('');
    expect(res.body.categories[0].icon).toBe('');
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns a single category by id', async () => {
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).get('/cat-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('cat-1');
    expect(res.body.name).toBe('Pokemon');
  });

  it('returns 404 when PocketBase throws a 404 error', async () => {
    const notFound = Object.assign(new Error('Not found'), { status: 404 });
    mockPb.collection.mockReturnValue(makeCollection({ getOne: vi.fn().mockRejectedValue(notFound) }));
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  it('creates a category and returns 201', async () => {
    const col = makeCollection({ getFullList: vi.fn().mockResolvedValue([]) });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/').send({ name: 'Pokemon' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cat-1');
    expect(col.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pokemon' }));
  });

  it('returns 403 when user is not an admin', async () => {
    mockUser = { id: 'user-1', role: 'user' };
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).post('/').send({ name: 'Pokemon' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin access required/i);
  });

  it('returns 400 when name is missing', async () => {
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).post('/').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when name is whitespace only', async () => {
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).post('/').send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a category with the same name already exists', async () => {
    const col = makeCollection({ getFullList: vi.fn().mockResolvedValue([CAT]) });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/').send({ name: 'Pokemon' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('trims whitespace from the name before creating', async () => {
    const col = makeCollection({ getFullList: vi.fn().mockResolvedValue([]) });
    mockPb.collection.mockReturnValue(col);
    await request(app).post('/').send({ name: '  Pokemon  ' });
    expect(col.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pokemon' }));
  });

  it('does not fail when the audit log write fails', async () => {
    const auditError = new Error('audit unavailable');
    mockPb.collection.mockImplementation((name) => {
      if (name === 'auditLogs') return makeCollection({ create: vi.fn().mockRejectedValue(auditError) });
      return makeCollection({ getFullList: vi.fn().mockResolvedValue([]) });
    });
    const res = await request(app).post('/').send({ name: 'NewCat' });
    // Category was created; audit failure is swallowed
    expect(res.status).toBe(201);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────

describe('PUT /:id', () => {
  it('updates and returns the category', async () => {
    const updated = { ...CAT, name: 'Magic' };
    const col = makeCollection({ update: vi.fn().mockResolvedValue(updated) });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).put('/cat-1').send({ name: 'Magic' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Magic');
    expect(col.update).toHaveBeenCalledWith('cat-1', expect.objectContaining({ name: 'Magic' }));
  });

  it('returns 403 when user is not an admin', async () => {
    mockUser = { id: 'user-1', role: 'user' };
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).put('/cat-1').send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when an explicit empty name is sent', async () => {
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).put('/cat-1').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be empty/i);
  });

  it('allows partial updates (description only)', async () => {
    const col = makeCollection();
    mockPb.collection.mockReturnValue(col);
    await request(app).put('/cat-1').send({ description: 'Updated desc' });
    expect(col.update).toHaveBeenCalledWith('cat-1', expect.objectContaining({ description: 'Updated desc' }));
    // name key should not be present in updateData
    const updateData = col.update.mock.calls[0][1];
    expect(updateData).not.toHaveProperty('name');
  });

  it('returns 404 when PocketBase throws a 404 error', async () => {
    const notFound = Object.assign(new Error('Not found'), { status: 404 });
    mockPb.collection.mockReturnValue(makeCollection({ getOne: vi.fn().mockRejectedValue(notFound) }));
    const res = await request(app).put('/nonexistent').send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /:id', () => {
  it('deletes the category and returns success', async () => {
    // categories col: getOne succeeds; subcategories col: no dependents
    mockPb.collection.mockImplementation((name) => {
      if (name === 'subcategories') return makeCollection({ getFullList: vi.fn().mockResolvedValue([]) });
      return makeCollection();
    });
    const res = await request(app).delete('/cat-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when user is not an admin', async () => {
    mockUser = { id: 'user-1', role: 'user' };
    mockPb.collection.mockReturnValue(makeCollection());
    const res = await request(app).delete('/cat-1');
    expect(res.status).toBe(403);
  });

  it('returns 400 when dependent subcategories exist', async () => {
    const sub = { id: 'sub-1', parentCategory: 'cat-1' };
    mockPb.collection.mockImplementation((name) => {
      if (name === 'subcategories') return makeCollection({ getFullList: vi.fn().mockResolvedValue([sub]) });
      return makeCollection();
    });
    const res = await request(app).delete('/cat-1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dependent subcategor/i);
    expect(res.body.dependentCount).toBe(1);
  });

  it('does NOT call pb.delete when dependent subcategories exist', async () => {
    const sub = { id: 'sub-1' };
    const catCol = makeCollection();
    mockPb.collection.mockImplementation((name) => {
      if (name === 'subcategories') return makeCollection({ getFullList: vi.fn().mockResolvedValue([sub]) });
      return catCol;
    });
    await request(app).delete('/cat-1');
    expect(catCol.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when category does not exist', async () => {
    const notFound = Object.assign(new Error('Not found'), { status: 404 });
    mockPb.collection.mockReturnValue(makeCollection({ getOne: vi.fn().mockRejectedValue(notFound) }));
    const res = await request(app).delete('/nonexistent');
    expect(res.status).toBe(404);
  });
});
