import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { admin: {} } }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let mockUser = { id: 'user-1', app_metadata: {} };
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  decodeAal: () => 'aal2',
  default: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = mockUser; next(); },
  optionalAuthMiddleware: (req, _res, next) => { req.user = mockUser; next(); },
  isAdminUser: async (req) => req.user?.app_metadata?.is_admin === true,
}));

import vaultRouter from '../../src/routes/vault.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  // Inject req.user for routes that check it without authMiddleware (GET /:id)
  app.use((req, _res, next) => { req.user = mockUser; next(); });
  app.use('/', vaultRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// ─── helpers ──────────────────────────────────────────────────────────────────

const ITEM = {
  id: 'item-1', title: 'Charizard', description: 'Rare card', asking_price: 100,
  user_id: 'user-1', owner_id: 'user-1', is_public: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  profiles: { username: 'trainer1', business_name: null },
};

function makeBuilder(result = { data: null, error: null, count: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'user-1', app_metadata: {} };
});

// ─── GET /products ────────────────────────────────────────────────────────────

describe('GET /products', () => {
  it('returns mapped vault items for user', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [ITEM], error: null, count: 1 }));
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Charizard');
    expect(res.body.products[0].price).toBe(100);
    expect(res.body.total).toBe(1);
  });

  it('defaults to page 1 and limit 20', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/products');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('clamps limit to 100', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/products?limit=999');
    expect(res.body.limit).toBe(100);
  });

  it('admin can fetch all items without user_id filter', async () => {
    mockUser = { id: 'admin-1', app_metadata: { is_admin: true } };
    const b = makeBuilder({ data: [ITEM], error: null, count: 1 });
    mockSupabase.from.mockReturnValue(b);
    await request(app).get('/products');
    const eqCalls = b.eq.mock.calls;
    expect(eqCalls.every(c => c[0] !== 'user_id')).toBe(true);
  });
});

// ─── GET /public ──────────────────────────────────────────────────────────────

describe('GET /products query robustness', () => {
  it('does not 500 when sort is repeated', async () => {
    mockUser = { id: 'user-1', app_metadata: {} };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/products?sort=a&sort=b');
    expect(res.status).toBe(200);
  });
});

describe('GET /public', () => {
  it('returns public items with userName from profiles', async () => {
    const publicItem = { ...ITEM, is_public: true };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [publicItem], error: null, count: 1 }));
    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.products[0].name).toBe('Charizard');
    expect(res.body.products[0].userName).toBe('trainer1');
  });

  it('prefers business_name over username', async () => {
    const bizItem = { ...ITEM, is_public: true, profiles: { username: 'trainer1', business_name: 'Card Shop' } };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [bizItem], error: null, count: 1 }));
    const res = await request(app).get('/public');
    expect(res.body.products[0].userName).toBe('Card Shop');
  });

  it('falls back to Unknown when profiles is null', async () => {
    const noProfile = { ...ITEM, is_public: true, profiles: null };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [noProfile], error: null, count: 1 }));
    const res = await request(app).get('/public');
    expect(res.body.products[0].userName).toBe('Unknown');
  });

  it('rejects non-UUID userId with 400', async () => {
    const res = await request(app).get('/public?userId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid userid/i);
  });

  it('accepts a valid UUID userId and filters results', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/public?userId=00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
  });

  // Express parses a repeated parameter into an array, so `sort.replace(...)`
  // used to throw a TypeError and answer 500 on this unauthenticated endpoint.
  it('does not 500 when sort is repeated', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/public?sort=a&sort=b');
    expect(res.status).toBe(200);
  });

  it('does not 500 when userId is repeated', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/public?userId=not-a-uuid&userId=x');
    // Still validated — collapsed to the first entry, which is not a UUID.
    expect(res.status).toBe(400);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns a public item without auth', async () => {
    mockUser = null;
    const publicItem = { ...ITEM, is_public: true };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: publicItem, error: null }));
    const res = await request(app).get('/item-1');
    expect(res.status).toBe(200);
    expect(res.body.is_public).toBe(true);
  });

  it('returns 404 on PGRST116', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { code: 'PGRST116' } }));
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns private item for its owner', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: ITEM, error: null }));
    const res = await request(app).get('/item-1');
    expect(res.status).toBe(200);
    expect(res.body.is_public).toBe(false);
  });

  it('returns 403 for private item owned by another user', async () => {
    mockUser = { id: 'other-user', app_metadata: {} };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: ITEM, error: null }));
    const res = await request(app).get('/item-1');
    expect(res.status).toBe(403);
  });

  it('allows admin to access any private item', async () => {
    mockUser = { id: 'admin-1', app_metadata: { is_admin: true } };
    mockSupabase.from.mockReturnValue(makeBuilder({ data: ITEM, error: null }));
    const res = await request(app).get('/item-1');
    expect(res.status).toBe(200);
  });

  it('returns 403 when user is null and item is private', async () => {
    mockUser = null;
    mockSupabase.from.mockReturnValue(makeBuilder({ data: ITEM, error: null }));
    const res = await request(app).get('/item-1');
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /:id/base-value ────────────────────────────────────────────────────

describe('PATCH /:id/base-value', () => {
  // Full reset so mockReturnValueOnce queues from earlier describe blocks don't leak in.
  beforeEach(() => vi.resetAllMocks());

  function makeUpdateBuilder(result) {
    const b = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return b;
  }

  function setupPatchMocks({ isAdmin, updateResult }) {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') return makeBuilder({ data: { is_admin: isAdmin }, error: null });
      return makeUpdateBuilder(updateResult ?? { data: null, error: null });
    });
  }

  it('returns 403 when profiles DB says user is not admin', async () => {
    mockUser = { id: 'user-1', app_metadata: { is_admin: true } };
    setupPatchMocks({ isAdmin: false });
    const res = await request(app).patch('/item-1/base-value').send({ newValue: 50 });
    expect(res.status).toBe(403);
  });

  it('updates base value when profiles DB confirms admin', async () => {
    mockUser = { id: 'admin-1', app_metadata: { is_admin: true } };
    setupPatchMocks({
      isAdmin: true,
      updateResult: { data: { id: 'item-1', card_name: 'Charizard', locked_base_value_aud: 50 }, error: null },
    });
    const res = await request(app).patch('/item-1/base-value').send({ newValue: 50, reason: 'market correction' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid newValue', async () => {
    mockUser = { id: 'admin-1', app_metadata: { is_admin: true } };
    setupPatchMocks({ isAdmin: true });
    const res = await request(app).patch('/item-1/base-value').send({ newValue: -5 });
    expect(res.status).toBe(400);
  });
});
