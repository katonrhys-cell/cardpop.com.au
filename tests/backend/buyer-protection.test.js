import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'buyer-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));

import buyerProtectionRouter from '../../src/routes/buyer-protection.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', buyerProtectionRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return b;
}

function queueFrom(...builders) {
  builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(false);
});

// ─── GET /my-claims ───────────────────────────────────────────────────────────

describe('GET /my-claims', () => {
  it('returns the buyer\'s claims', async () => {
    const claims = [{ id: 'c1', order_id: 'o1' }];
    queueFrom(makeBuilder({ data: claims, error: null }));
    const res = await request(app).get('/my-claims');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(claims);
    expect(mockSupabase.from).toHaveBeenCalledWith('buyer_protection_claims');
  });

  it('returns an empty array when there are no claims', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).get('/my-claims');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on a query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/my-claims');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to fetch claims/i);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /', () => {
  const valid = { order_id: 'o1', claim_type: 'damaged', description: 'Arrived broken' };

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/').send({ order_id: 'o1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for an invalid claim_type', async () => {
    const res = await request(app).post('/').send({ ...valid, claim_type: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid claim type/i);
  });

  it('returns 404 when the order does not exist', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/order not found/i);
  });

  it('returns 403 when the order belongs to another buyer', async () => {
    queueFrom(makeBuilder({ data: { buyer_id: 'someone-else', seller_id: 's1' }, error: null }));
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/your own orders/i);
  });

  it('returns 400 when a claim already exists for the order', async () => {
    queueFrom(
      makeBuilder({ data: { buyer_id: 'buyer-1', seller_id: 's1' }, error: null }), // order
      makeBuilder({ data: { id: 'existing' }, error: null }), // existing claim
    );
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('creates the claim and returns 201 with seller derived from the order', async () => {
    const created = { id: 'c2', order_id: 'o1', buyer_id: 'buyer-1', seller_id: 's1', status: 'pending' };
    const insertBuilder = makeBuilder({ data: created, error: null });
    queueFrom(
      makeBuilder({ data: { buyer_id: 'buyer-1', seller_id: 's1' }, error: null }), // order
      makeBuilder({ data: null, error: null }), // no existing claim
      insertBuilder,
    );

    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      order_id: 'o1',
      buyer_id: 'buyer-1',
      seller_id: 's1',
      claim_type: 'damaged',
      status: 'pending',
    }));
  });

  it('returns 500 when the insert errors', async () => {
    queueFrom(
      makeBuilder({ data: { buyer_id: 'buyer-1', seller_id: 's1' }, error: null }),
      makeBuilder({ data: null, error: null }),
      makeBuilder({ data: null, error: new Error('insert failed') }),
    );
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:claimId/status ──────────────────────────────────────────────────────

describe('PUT /:claimId/status', () => {
  it('returns 400 for an invalid status', async () => {
    const res = await request(app).put('/c1/status').send({ status: 'maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid status/i);
  });

  it('returns 403 for non-admin users', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).put('/c1/status').send({ status: 'investigating' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin access required/i);
  });

  it('updates status for an admin', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const updated = { id: 'c1', status: 'investigating' };
    const builder = makeBuilder({ data: updated, error: null });
    queueFrom(builder);

    const res = await request(app).put('/c1/status').send({ status: 'investigating' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'investigating' }));
    // Non-resolved updates must not write resolution fields.
    expect(builder.update.mock.calls[0][0]).not.toHaveProperty('resolution');
  });

  it('records resolution and refund details when resolving', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    const builder = makeBuilder({ data: { id: 'c1', status: 'resolved' }, error: null });
    queueFrom(builder);

    const res = await request(app)
      .put('/c1/status')
      .send({ status: 'resolved', resolution: 'Full refund', refund_amount: 49.99 });
    expect(res.status).toBe(200);
    const payload = builder.update.mock.calls[0][0];
    expect(payload.resolution).toBe('Full refund');
    expect(payload.refund_amount).toBe(49.99);
    expect(payload.resolved_at).toBeTypeOf('string');
  });

  it('returns 500 when the update errors', async () => {
    mockIsAdminUser.mockResolvedValue(true);
    queueFrom(makeBuilder({ data: null, error: new Error('update failed') }));
    const res = await request(app).put('/c1/status').send({ status: 'rejected' });
    expect(res.status).toBe(500);
  });
});

// ─── GET /:claimId ─────────────────────────────────────────────────────────────

describe('GET /:claimId', () => {
  it('returns 404 when the claim does not exist', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).get('/c1');
    expect(res.status).toBe(404);
  });

  it('returns 403 when the user is neither buyer nor seller', async () => {
    queueFrom(makeBuilder({ data: { id: 'c1', buyer_id: 'x', seller_id: 'y' }, error: null }));
    const res = await request(app).get('/c1');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('returns the claim when the user is the buyer', async () => {
    const claim = { id: 'c1', buyer_id: 'buyer-1', seller_id: 'y' };
    queueFrom(makeBuilder({ data: claim, error: null }));
    const res = await request(app).get('/c1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(claim);
  });

  it('returns the claim when the user is the seller', async () => {
    const claim = { id: 'c1', buyer_id: 'x', seller_id: 'buyer-1' };
    queueFrom(makeBuilder({ data: claim, error: null }));
    const res = await request(app).get('/c1');
    expect(res.status).toBe(200);
  });

  it('returns 500 on a query error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).get('/c1');
    expect(res.status).toBe(500);
  });
});
