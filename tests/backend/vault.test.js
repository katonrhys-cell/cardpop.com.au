import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mock pocketbase before importing the router ──────────────────────────────

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
}));

vi.mock('../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Auth middleware — regular user by default; override per-test to set role/id
let mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' };
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = mockUser;
    next();
  },
}));

import vaultRouter from '../../src/routes/vault.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  // Inject req.user for routes that check it directly without authMiddleware (e.g. GET /:id)
  app.use((req, _res, next) => { req.user = mockUser; next(); });
  app.use('/', vaultRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

const app = makeApp();

// Helper to build a mock PocketBase collection
function makeVaultCollection(overrides = {}) {
  return {
    getFullList: vi.fn().mockResolvedValue([]),
    getList: vi.fn().mockResolvedValue({ items: [] }),
    getOne: vi.fn(),
    ...overrides,
  };
}

const SAMPLE_PRODUCT = {
  id: 'prod-1',
  name: 'Charizard Base Set',
  description: 'Holographic Rare',
  price: 250,
  userId: 'user-123',
  is_public: false,
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-02T00:00:00Z',
  expand: { userId: { name: 'Test User' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' };
});

// ─── GET /products ────────────────────────────────────────────────────────────

describe('GET /products', () => {
  it('returns paginated products for the authenticated user', async () => {
    const col = makeVaultCollection({
      getFullList: vi.fn().mockResolvedValue([SAMPLE_PRODUCT]),
      getList: vi.fn().mockResolvedValue({ items: [SAMPLE_PRODUCT] }),
    });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe('prod-1');
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });

  it('clamps limit to a maximum of 100', async () => {
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/products?limit=500');
    const getListCall = col.getList.mock.calls[0];
    expect(getListCall[1]).toBe(100); // second arg is limitNum
  });

  it('defaults to page 1 and limit 20', async () => {
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/products');
    const getListCall = col.getList.mock.calls[0];
    expect(getListCall[0]).toBe(1);
    expect(getListCall[1]).toBe(20);
  });

  it('filters by userId for non-admin users', async () => {
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/products');
    const getListCall = col.getList.mock.calls[0];
    expect(getListCall[2].filter).toContain('user-123');
  });

  it('applies no filter for admin users', async () => {
    mockUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/products');
    const getListCall = col.getList.mock.calls[0];
    // undefined means no filter — admin sees all
    expect(getListCall[2].filter).toBeUndefined();
  });

  it('returns correct totalPages', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ ...SAMPLE_PRODUCT, id: `prod-${i}` }));
    const col = makeVaultCollection({
      getFullList: vi.fn().mockResolvedValue(items), // total = 5
      getList: vi.fn().mockResolvedValue({ items: items.slice(0, 2) }),
    });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/products?limit=2');
    expect(res.body.totalPages).toBe(3); // ceil(5/2)
  });
});

// ─── GET /public ──────────────────────────────────────────────────────────────

describe('GET /public', () => {
  const PUBLIC_PRODUCT = { ...SAMPLE_PRODUCT, is_public: true };

  it('returns public products without auth', async () => {
    const col = makeVaultCollection({
      getFullList: vi.fn().mockResolvedValue([PUBLIC_PRODUCT]),
      getList: vi.fn().mockResolvedValue({ items: [PUBLIC_PRODUCT] }),
    });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
  });

  it('always filters by is_public = true', async () => {
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/public');
    const getListCall = col.getList.mock.calls[0];
    expect(getListCall[2].filter).toContain('is_public = true');
  });

  it('additionally filters by userId when provided', async () => {
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/public?userId=user-456');
    const getListCall = col.getList.mock.calls[0];
    expect(getListCall[2].filter).toContain('is_public = true');
    expect(getListCall[2].filter).toContain('user-456');
  });

  it('ignores whitespace-only userId query param', async () => {
    const col = makeVaultCollection();
    mockPb.collection.mockReturnValue(col);

    await request(app).get('/public?userId=%20');
    const getListCall = col.getList.mock.calls[0];
    expect(getListCall[2].filter).toBe('is_public = true');
  });

  it('expands userId for user name display', async () => {
    const productWithExpand = {
      ...PUBLIC_PRODUCT,
      expand: { userId: { name: 'John Doe' } },
    };
    const col = makeVaultCollection({
      getFullList: vi.fn().mockResolvedValue([productWithExpand]),
      getList: vi.fn().mockResolvedValue({ items: [productWithExpand] }),
    });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/public');
    expect(res.body.products[0].userName).toBe('John Doe');
  });

  it('falls back to "Unknown" when expand is missing', async () => {
    const productNoExpand = { ...PUBLIC_PRODUCT, expand: undefined };
    const col = makeVaultCollection({
      getFullList: vi.fn().mockResolvedValue([productNoExpand]),
      getList: vi.fn().mockResolvedValue({ items: [productNoExpand] }),
    });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/public');
    expect(res.body.products[0].userName).toBe('Unknown');
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns a public product to anyone', async () => {
    const publicProduct = { ...SAMPLE_PRODUCT, is_public: true };
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(publicProduct) });
    mockPb.collection.mockReturnValue(col);

    // Hit as a different user — should still succeed
    mockUser = { id: 'other-user', email: 'other@example.com', role: 'user' };
    const res = await request(app).get('/prod-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('prod-1');
    expect(res.body.is_public).toBe(true);
  });

  it('returns a private product to the owner', async () => {
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(SAMPLE_PRODUCT) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/prod-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('prod-1');
  });

  it('returns a private product to an admin', async () => {
    mockUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(SAMPLE_PRODUCT) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/prod-1');
    expect(res.status).toBe(200);
  });

  it('returns 403 when an unauthenticated request targets a private product', async () => {
    // Simulate unauthenticated by setting req.user to null in the mock
    mockUser = null;
    // authMiddleware mock always sets req.user = mockUser (null here)
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(SAMPLE_PRODUCT) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/prod-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 when a non-owner tries to access a private product', async () => {
    mockUser = { id: 'other-user', email: 'other@example.com', role: 'user' };
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(SAMPLE_PRODUCT) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/prod-1');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unauthorized/i);
  });

  it('returns 404 when PocketBase throws a 404 error', async () => {
    const notFound = Object.assign(new Error('Not found'), { status: 404 });
    const col = makeVaultCollection({ getOne: vi.fn().mockRejectedValue(notFound) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('surfaces the product fields in the response', async () => {
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(SAMPLE_PRODUCT) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/prod-1');
    expect(res.body).toMatchObject({
      id: 'prod-1',
      name: 'Charizard Base Set',
      description: 'Holographic Rare',
      price: 250,
      userId: 'user-123',
      is_public: false,
    });
  });

  it('includes userName from the expanded userId relation', async () => {
    const col = makeVaultCollection({ getOne: vi.fn().mockResolvedValue(SAMPLE_PRODUCT) });
    mockPb.collection.mockReturnValue(col);

    const res = await request(app).get('/prod-1');
    expect(res.body.userName).toBe('Test User');
  });
});
