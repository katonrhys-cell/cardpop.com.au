import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({ collection: vi.fn() }));

vi.mock('../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let mockUser = { id: 'admin-1', role: 'admin' };
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = mockUser; next(); },
}));

import subcatsRouter from '../../src/routes/subcategories.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', subcatsRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

const PARENT = { id: 'cat-1', name: 'Pokemon' };
const SUB = {
  id: 'sub-1', name: 'Vintage', description: 'Old cards',
  parentCategory: 'cat-1', created: '2026-01-01T00:00:00Z', updated: '2026-01-02T00:00:00Z',
  expand: { parentCategory: PARENT },
};

function makeCol(overrides = {}) {
  return {
    getFullList: vi.fn().mockResolvedValue([]),
    getList:     vi.fn().mockResolvedValue({ items: [] }),
    getOne:      vi.fn().mockResolvedValue(SUB),
    create:      vi.fn().mockResolvedValue(SUB),
    update:      vi.fn().mockResolvedValue(SUB),
    delete:      vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'admin-1', role: 'admin' };
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns paginated subcategories', async () => {
    const col = makeCol({ getFullList: vi.fn().mockResolvedValue([SUB]), getList: vi.fn().mockResolvedValue({ items: [SUB] }) });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.subcategories).toHaveLength(1);
    expect(res.body.subcategories[0].parentCategoryName).toBe('Pokemon');
  });

  it('filters by categoryId when provided', async () => {
    const col = makeCol();
    mockPb.collection.mockReturnValue(col);
    await request(app).get('/?categoryId=cat-1');
    expect(col.getList.mock.calls[0][2].filter).toContain('cat-1');
  });

  it('applies no filter when categoryId is absent', async () => {
    const col = makeCol();
    mockPb.collection.mockReturnValue(col);
    await request(app).get('/');
    expect(col.getList.mock.calls[0][2].filter).toBeUndefined();
  });

  it('ignores whitespace-only categoryId', async () => {
    const col = makeCol();
    mockPb.collection.mockReturnValue(col);
    await request(app).get('/?categoryId=%20');
    expect(col.getList.mock.calls[0][2].filter).toBeUndefined();
  });

  it('clamps limit to 100', async () => {
    const col = makeCol();
    mockPb.collection.mockReturnValue(col);
    await request(app).get('/?limit=999');
    expect(col.getList.mock.calls[0][1]).toBe(100);
  });

  it('falls back to "Unknown" when expand is missing', async () => {
    const noExpand = { ...SUB, expand: undefined };
    const col = makeCol({ getFullList: vi.fn().mockResolvedValue([noExpand]), getList: vi.fn().mockResolvedValue({ items: [noExpand] }) });
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).get('/');
    expect(res.body.subcategories[0].parentCategoryName).toBe('Unknown');
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns a single subcategory with parentCategoryName', async () => {
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).get('/sub-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sub-1');
    expect(res.body.parentCategoryName).toBe('Pokemon');
  });

  it('returns 404 when PocketBase throws status 404', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    mockPb.collection.mockReturnValue(makeCol({ getOne: vi.fn().mockRejectedValue(notFound) }));
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  it('creates and returns 201', async () => {
    mockPb.collection.mockImplementation((name) => {
      if (name === 'categories') return makeCol({ getOne: vi.fn().mockResolvedValue(PARENT) });
      return makeCol({ getFullList: vi.fn().mockResolvedValue([]) });
    });
    const res = await request(app).post('/').send({ name: 'Vintage', parentCategory: 'cat-1' });
    expect(res.status).toBe(201);
    expect(res.body.parentCategoryName).toBe('Pokemon');
  });

  it('returns 403 when not admin', async () => {
    mockUser = { id: 'user-1', role: 'user' };
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).post('/').send({ name: 'Vintage', parentCategory: 'cat-1' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).post('/').send({ parentCategory: 'cat-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when parentCategory is missing', async () => {
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).post('/').send({ name: 'Vintage' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parent category/i);
  });

  it('returns 400 when parent category does not exist', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    mockPb.collection.mockImplementation((name) => {
      if (name === 'categories') return makeCol({ getOne: vi.fn().mockRejectedValue(notFound) });
      return makeCol();
    });
    const res = await request(app).post('/').send({ name: 'Vintage', parentCategory: 'bad-cat' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parent category not found/i);
  });

  it('returns 400 when subcategory name already exists in this category', async () => {
    mockPb.collection.mockImplementation((name) => {
      if (name === 'categories') return makeCol({ getOne: vi.fn().mockResolvedValue(PARENT) });
      return makeCol({ getFullList: vi.fn().mockResolvedValue([SUB]) });
    });
    const res = await request(app).post('/').send({ name: 'Vintage', parentCategory: 'cat-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────

describe('PUT /:id', () => {
  it('updates and returns the subcategory', async () => {
    const updated = { ...SUB, name: 'Modern', parentCategory: 'cat-1', expand: { parentCategory: PARENT } };
    mockPb.collection.mockImplementation((name) => {
      if (name === 'categories') return makeCol({ getOne: vi.fn().mockResolvedValue(PARENT) });
      return makeCol({ update: vi.fn().mockResolvedValue(updated) });
    });
    const res = await request(app).put('/sub-1').send({ name: 'Modern' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Modern');
  });

  it('returns 403 when not admin', async () => {
    mockUser = { id: 'user-1', role: 'user' };
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).put('/sub-1').send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when name is explicitly set to empty', async () => {
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).put('/sub-1').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be empty/i);
  });

  it('returns 400 when new parentCategory does not exist', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    mockPb.collection.mockImplementation((name) => {
      if (name === 'categories') return makeCol({ getOne: vi.fn().mockRejectedValue(notFound) });
      return makeCol();
    });
    const res = await request(app).put('/sub-1').send({ parentCategory: 'bad-cat' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parent category not found/i);
  });

  it('returns 404 when subcategory does not exist', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    mockPb.collection.mockReturnValue(makeCol({ getOne: vi.fn().mockRejectedValue(notFound) }));
    const res = await request(app).put('/nonexistent').send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /:id', () => {
  it('deletes and returns success', async () => {
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).delete('/sub-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when not admin', async () => {
    mockUser = { id: 'user-1', role: 'user' };
    mockPb.collection.mockReturnValue(makeCol());
    const res = await request(app).delete('/sub-1');
    expect(res.status).toBe(403);
  });

  it('returns 404 when subcategory does not exist', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    mockPb.collection.mockReturnValue(makeCol({ getOne: vi.fn().mockRejectedValue(notFound) }));
    const res = await request(app).delete('/nonexistent');
    expect(res.status).toBe(404);
  });
});
