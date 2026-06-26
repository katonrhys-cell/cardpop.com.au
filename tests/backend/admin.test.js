import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());
const mockPayoutSeller = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: { transfers: { create: vi.fn() } } }));
vi.mock('../../src/services/payoutService.js', () => ({ payoutSeller: mockPayoutSeller }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));

import adminRouter from '../../src/routes/admin.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), update: vi.fn(() => b), insert: vi.fn(() => b), eq: vi.fn(() => b),
    order: vi.fn(() => b), limit: vi.fn(() => b), not: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
  mockPayoutSeller.mockResolvedValue({ status: 'transferred', transferId: 'tr_x' });
});

// ─── admin gate ────────────────────────────────────────────────────────────────

describe('admin gate', () => {
  it('rejects non-admins on every endpoint with 403', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const r1 = await request(app).patch('/admin/users/u2/role').send({ is_admin: true });
    const r2 = await request(app).patch('/admin/verifications/v1').send({ status: 'approved' });
    const r3 = await request(app).patch('/admin/refunds/r1').send({ action: 'approve' });
    expect([r1.status, r2.status, r3.status]).toEqual([403, 403, 403]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

// ─── PATCH /users/:userId/role ─────────────────────────────────────────────────

describe('PATCH /users/:userId/role', () => {
  it('updates a user admin flag for an admin', async () => {
    queueFrom(makeBuilder({ data: { id: 'u2', is_admin: true }, error: null }), makeBuilder()); // update + audit insert
    const res = await request(app).patch('/admin/users/u2/role').send({ is_admin: true });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'u2', is_admin: true });
  });

  it('requires a boolean is_admin', async () => {
    const res = await request(app).patch('/admin/users/u2/role').send({ is_admin: 'yes' });
    expect(res.status).toBe(400);
  });

  it('refuses to let an admin revoke their own access', async () => {
    const res = await request(app).patch('/admin/users/admin-1/role').send({ is_admin: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/your own admin access/i);
  });

  it('returns 500 on a db error', async () => {
    queueFrom(makeBuilder({ data: null, error: new Error('db down') }));
    const res = await request(app).patch('/admin/users/u2/role').send({ is_admin: true });
    expect(res.status).toBe(500);
  });
});

// ─── PATCH /verifications/:id ──────────────────────────────────────────────────

describe('PATCH /verifications/:id', () => {
  it('applies a status decision and writes the audit log', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'v1', status: 'approved' }, error: null });
    queueFrom(updateBuilder, makeBuilder()); // update + audit insert
    const res = await request(app).patch('/admin/verifications/v1').send({ status: 'approved', admin_notes: 'looks good' });
    expect(res.status).toBe(200);
    expect(res.body.verification).toMatchObject({ status: 'approved' });
    // admin_id comes from the token, status from the body.
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ admin_id: 'admin-1', status: 'approved' }));
  });

  it('rejects an invalid status', async () => {
    const res = await request(app).patch('/admin/verifications/v1').send({ status: 'totally-verified' });
    expect(res.status).toBe(400);
  });

  it('handles an info request without a status', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'v1' }, error: null });
    queueFrom(updateBuilder, makeBuilder());
    const res = await request(app).patch('/admin/verifications/v1')
      .send({ info_request: true, additional_info_requested: 'Need a clearer photo' });
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ additional_info_requested: 'Need a clearer photo' }));
  });
});

// ─── PATCH /refunds/:id ────────────────────────────────────────────────────────

describe('PATCH /refunds/:id', () => {
  it('approves a refund, computing the amount server-side', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'r1', order_id: 'o1', buyer_id: 'b1', total_paid_aud: 100, commission_aud: 8, gst_aud: 2 }, error: null }), // fetch
      makeBuilder({ error: null }), // refunds update
      makeBuilder({ error: null }), // orders update
      makeBuilder({ error: null }), // notification insert
    );
    const res = await request(app).patch('/admin/refunds/r1').send({ action: 'approve' });
    expect(res.status).toBe(200);
    // retained = (8+2)*0.5 = 5; refund = 100 - 5 = 95
    expect(res.body).toMatchObject({ status: 'approved', refundAmount: 95 });
  });

  it('requires a reason to reject', async () => {
    const res = await request(app).patch('/admin/refunds/r1').send({ action: 'reject' });
    expect(res.status).toBe(400);
  });

  it('rejects a refund with a reason', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'r1', order_id: 'o1', buyer_id: 'b1' }, error: null }), // fetch
      makeBuilder({ error: null }), makeBuilder({ error: null }), makeBuilder({ error: null }),
    );
    const res = await request(app).patch('/admin/refunds/r1').send({ action: 'reject', rejection_reason: 'Item delivered as described' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  it('returns 404 for an unknown refund', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).patch('/admin/refunds/missing').send({ action: 'approve' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid action', async () => {
    const res = await request(app).patch('/admin/refunds/r1').send({ action: 'maybe' });
    expect(res.status).toBe(400);
  });
});

// ─── disputes ───────────────────────────────────────────────────────────────────

describe('GET /disputes', () => {
  it('lists disputes for an admin', async () => {
    queueFrom(makeBuilder({ data: [{ id: 'd1' }, { id: 'd2' }], error: null }));
    const res = await request(app).get('/admin/disputes');
    expect(res.status).toBe(200);
    expect(res.body.disputes).toHaveLength(2);
  });

  it('rejects non-admins', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).get('/admin/disputes');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /disputes/:id', () => {
  it('releases a frozen payout by paying the seller their proceeds', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'd1', order_id: 'o1' }, error: null }),                       // dispute fetch
      makeBuilder({ data: { id: 'o1', seller_id: 's1', listing_id: 'l1', seller_proceeds_aud: 230 }, error: null }), // order fetch
      makeBuilder({ data: { id: 'd1', status: 'resolved_released' }, error: null }),          // dispute update
    );
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release', resolution_notes: 'won' });
    expect(res.status).toBe(200);
    expect(mockPayoutSeller).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sellerId: 's1', sellerProceeds: 230, orderId: 'o1' }));
    expect(res.body.dispute.status).toBe('resolved_released');
  });

  it('keeps the payout frozen without paying out', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'd1', order_id: 'o1' }, error: null }),                 // dispute fetch
      makeBuilder({ data: { id: 'd1', status: 'resolved_kept' }, error: null }),        // dispute update
    );
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'keep_frozen' });
    expect(res.status).toBe(200);
    expect(mockPayoutSeller).not.toHaveBeenCalled();
  });

  it('rejects an invalid action', async () => {
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'whatever' });
    expect(res.status).toBe(400);
  });

  it('404s an unknown dispute', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).patch('/admin/disputes/missing').send({ action: 'keep_frozen' });
    expect(res.status).toBe(404);
  });
});
