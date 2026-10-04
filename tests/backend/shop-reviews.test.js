import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockService = vi.hoisted(() => ({ from: vi.fn() }));
const mockScoped = vi.hoisted(() => ({ from: vi.fn() }));
const mockCreateScoped = vi.hoisted(() => vi.fn(() => mockScoped));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockService, supabase: mockService }));
vi.mock('../../src/utils/userScopedSupabase.js', () => ({ default: mockCreateScoped, createUserScopedClient: mockCreateScoped }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  decodeAal: () => 'aal2',
  default: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'buyer-1' }; next(); },
  optionalAuthMiddleware: (_req, _res, next) => next(),
  isAdminUser: vi.fn(),
}));

import shopReviewsRouter from '../../src/routes/shop-reviews.js';

const app = express();
app.use(express.json());
app.use('/', shopReviewsRouter);

const ORDER = '11111111-1111-4111-8111-111111111111';
const PRODUCT = '22222222-2222-4222-8222-222222222222';

function builder(result) {
  const b = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /', () => {
  const body = { order_id: ORDER, product_id: PRODUCT, rating: 5, title: 'Great', body: 'Holds heaps' };

  it('inserts through the caller-scoped client with the reviewer taken from the token', async () => {
    const b = builder({ data: { id: 'r1', status: 'pending', created_at: 'now' }, error: null });
    mockScoped.from.mockReturnValueOnce(b);

    const res = await request(app).post('/').set('Authorization', 'Bearer tok-123').send({ ...body, reviewer_id: 'someone-else' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(mockCreateScoped).toHaveBeenCalledWith('tok-123');
    expect(mockService.from).not.toHaveBeenCalled();
    expect(b.insert).toHaveBeenCalledWith({
      order_id: ORDER, product_id: PRODUCT, reviewer_id: 'buyer-1', rating: 5, title: 'Great', body: 'Holds heaps',
    });
  });

  it('rejects an out-of-range rating before touching the database', async () => {
    const res = await request(app).post('/').send({ ...body, rating: 6 });
    expect(res.status).toBe(400);
    expect(mockScoped.from).not.toHaveBeenCalled();
  });

  it.each([
    ['23505', 409],
    ['42501', 403],
    ['22023', 400],
  ])('maps database error %s to %i', async (code, status) => {
    mockScoped.from.mockReturnValueOnce(builder({ data: null, error: { code, message: 'nope' } }));
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(status);
  });

  it('answers 500 on an unexpected error', async () => {
    mockScoped.from.mockReturnValueOnce(builder({ data: null, error: { code: 'XX000', message: 'boom' } }));
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(500);
  });
});

describe('admin moderation', () => {
  it('lists pending reviews by default', async () => {
    const b = builder({ data: [{ id: 'r1' }], error: null });
    mockService.from.mockReturnValueOnce(b);
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([{ id: 'r1' }]);
    expect(b.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('ignores an unknown status filter', async () => {
    const b = builder({ data: [], error: null });
    mockService.from.mockReturnValueOnce(b);
    await request(app).get('/admin?status=bogus');
    expect(b.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('publishes a review and stamps the moderator', async () => {
    const upd = builder({ data: { id: 'r1', status: 'published', moderated_at: 'now' }, error: null });
    const audit = builder({ data: null, error: null });
    mockService.from.mockReturnValueOnce(upd).mockReturnValueOnce(audit);
    const res = await request(app).patch('/admin/r1').send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(upd.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'published', moderated_by: 'buyer-1' }));
  });

  it('404s for a review that does not exist', async () => {
    mockService.from.mockReturnValueOnce(builder({ data: null, error: null }));
    const res = await request(app).patch('/admin/nope').send({ status: 'rejected' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid status', async () => {
    const res = await request(app).patch('/admin/r1').send({ status: 'deleted' });
    expect(res.status).toBe(400);
  });
});
