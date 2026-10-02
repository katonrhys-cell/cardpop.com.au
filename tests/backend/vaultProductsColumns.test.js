import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// /vault/products and /vault/public must read real vault_items columns
// (card_name, estimated_value_aud, notes) — never title / asking_price /
// description, which don't exist (sorting by them 500'd).

const mockFrom = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: { from: mockFrom }, supabase: { from: mockFrom } }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
  optionalAuthMiddleware: (_req, _res, next) => next(),
  isAdminUser: vi.fn(async () => false),
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({ requireAdmin: (_req, _res, next) => next() }));
vi.mock('../../src/routes/vault-items.js', () => ({ default: (_req, _res, next) => next() }));

import vaultRouter from '../../src/routes/vault.js';

const app = express();
app.use(express.json());
app.use('/', vaultRouter);

const ROW = {
  id: 'item-1', owner_id: 'user-1', card_name: 'Charizard', notes: 'my private note',
  estimated_value_aud: '250.50', is_public: true, created_at: '2026-01-01', updated_at: '2026-01-02',
  profiles: { username: 'trainer1', business_name: null },
};

let builder;
beforeEach(() => {
  builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => Promise.resolve({ data: [ROW], error: null, count: 1 })),
  };
  mockFrom.mockReturnValue(builder);
});

describe('vault list routes use real columns', () => {
  it.each([['name', 'card_name'], ['-price', 'estimated_value_aud']])('/products sort=%s orders by %s', async (sort, col) => {
    const res = await request(app).get(`/products?sort=${sort}`);
    expect(res.status).toBe(200);
    expect(builder.order).toHaveBeenCalledWith(col, expect.any(Object));
    expect(res.body.products[0]).toMatchObject({ name: 'Charizard', price: 250.5, description: 'my private note' });
  });

  it('/public sorts by estimated_value_aud and does not publish notes', async () => {
    const res = await request(app).get('/public?sort=-price');
    expect(res.status).toBe(200);
    expect(builder.order).toHaveBeenCalledWith('estimated_value_aud', { ascending: false });
    expect(res.body.products[0]).toMatchObject({ name: 'Charizard', price: 250.5, description: '', userName: 'trainer1' });
  });
});
