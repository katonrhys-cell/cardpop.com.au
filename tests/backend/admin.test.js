import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { admin: { updateUserById: vi.fn(() => Promise.resolve({ data: {}, error: null })) } },
}));
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
    const r4 = await request(app).patch('/admin/users/u2/status').send({ status: 'suspended' });
    expect([r1.status, r2.status, r3.status, r4.status]).toEqual([403, 403, 403, 403]);
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

// ─── PATCH /users/:userId/status ───────────────────────────────────────────────

describe('PATCH /users/:userId/status', () => {
  it('suspends a user: flips is_active and bans the auth user indefinitely', async () => {
    queueFrom(makeBuilder({ data: { id: 'u2', is_active: false, is_deleted: false }, error: null }), makeBuilder()); // profile update + audit insert
    const res = await request(app).patch('/admin/users/u2/status').send({ status: 'suspended' });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'u2', is_active: false, is_deleted: false });
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('u2', { ban_duration: '876000h' });
  });

  it('reactivates a user: restores is_active/is_deleted and lifts the ban', async () => {
    queueFrom(makeBuilder({ data: { id: 'u2', is_active: true, is_deleted: false }, error: null }), makeBuilder());
    const res = await request(app).patch('/admin/users/u2/status').send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('u2', { ban_duration: 'none' });
  });

  it('soft-deletes a user: sets is_deleted alongside is_active=false and bans', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'u2', is_active: false, is_deleted: true }, error: null });
    queueFrom(updateBuilder, makeBuilder());
    const res = await request(app).patch('/admin/users/u2/status').send({ status: 'deleted' });
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ is_active: false, is_deleted: true });
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('u2', { ban_duration: '876000h' });
  });

  it('refuses to let an admin change their own account status', async () => {
    const res = await request(app).patch('/admin/users/admin-1/status').send({ status: 'suspended' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/your own account status/i);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects an invalid status', async () => {
    const res = await request(app).patch('/admin/users/u2/status').send({ status: 'banned-forever' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when the ban call fails', async () => {
    queueFrom(makeBuilder({ data: { id: 'u2' }, error: null }));
    mockSupabase.auth.admin.updateUserById.mockResolvedValueOnce({ data: null, error: new Error('gotrue down') });
    const res = await request(app).patch('/admin/users/u2/status').send({ status: 'suspended' });
    expect(res.status).toBe(500);
  });
});

// ─── PATCH /verifications/:id ──────────────────────────────────────────────────

describe('PATCH /verifications/:id', () => {
  it('approves, grants verified status on the profile, and writes the audit log', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'v1', user_id: 'u9', status: 'approved' }, error: null });
    const profileBuilder = makeBuilder({ error: null });
    queueFrom(updateBuilder, profileBuilder, makeBuilder()); // verification update + profile sync + audit insert
    const res = await request(app).patch('/admin/verifications/v1').send({ status: 'approved', admin_notes: 'looks good' });
    expect(res.status).toBe(200);
    expect(res.body.verification).toMatchObject({ status: 'approved' });
    // admin_id comes from the token, status from the body.
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ admin_id: 'admin-1', status: 'approved' }));
    // the user's profile is marked verified
    expect(profileBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ is_verified: true, verification_status: 'approved' }));
    expect(profileBuilder.eq).toHaveBeenCalledWith('id', 'u9');
  });

  it('revokes verified status on the profile when rejected', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'v1', user_id: 'u9', status: 'rejected' }, error: null });
    const profileBuilder = makeBuilder({ error: null });
    queueFrom(updateBuilder, profileBuilder, makeBuilder());
    const res = await request(app).patch('/admin/verifications/v1').send({ status: 'rejected' });
    expect(res.status).toBe(200);
    expect(profileBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ is_verified: false, verification_status: 'rejected' }));
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
  it('approves a refund, computing the amount from the server-authoritative order', async () => {
    queueFrom(
      // The amount is computed from the joined ORDER (total_aud / platform_fee_aud),
      // NOT the buyer-supplied refund fields — those client values (here zeroed)
      // must be ignored so the fee retention can't be bypassed.
      makeBuilder({ data: { id: 'r1', order_id: 'o1', buyer_id: 'b1', total_paid_aud: 0, commission_aud: 0, gst_aud: 0, order: { total_aud: 100, platform_fee_aud: 10 } }, error: null }), // fetch
      makeBuilder({ error: null }), // refunds update
      makeBuilder({ error: null }), // orders update
      makeBuilder({ error: null }), // notification insert
    );
    const res = await request(app).patch('/admin/refunds/r1').send({ action: 'approve' });
    expect(res.status).toBe(200);
    // retained = platform_fee_aud(10) * 0.5 = 5; refund = total_aud(100) - 5 = 95
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

// ─── business-profiles ───────────────────────────────────────────────────────

describe('GET /business-profiles', () => {
  it('lists every business profile regardless of status', async () => {
    queueFrom(makeBuilder({ data: [{ id: 'b1' }, { id: 'b2' }], error: null }));
    const res = await request(app).get('/admin/business-profiles');
    expect(res.status).toBe(200);
    expect(res.body.businessProfiles).toHaveLength(2);
  });

  it('rejects non-admins', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).get('/admin/business-profiles');
    expect(res.status).toBe(403);
  });
});

describe('POST /business-profiles', () => {
  it('creates a profile linked to the user resolved by email', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'u9' }, error: null }), // profiles lookup by email
      makeBuilder({ data: { id: 'b1', business_name: 'Card Corner', user_id: 'u9' }, error: null }), // insert
      makeBuilder(), // audit insert
    );
    const res = await request(app).post('/admin/business-profiles').send({
      business_name: 'Card Corner',
      user_email: 'Owner@Example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.businessProfile).toMatchObject({ id: 'b1', user_id: 'u9' });
  });

  it('404s when no account matches the given email', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/admin/business-profiles').send({
      business_name: 'Card Corner',
      user_email: 'nobody@example.com',
    });
    expect(res.status).toBe(404);
  });

  it('requires a business name', async () => {
    const res = await request(app).post('/admin/business-profiles').send({ user_email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid user_email', async () => {
    const res = await request(app).post('/admin/business-profiles').send({ business_name: 'X', user_email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /business-profiles/:id', () => {
  it('approves a pending profile and stamps the reviewer', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'b1', storefront_status: 'approved' }, error: null });
    queueFrom(updateBuilder, makeBuilder());
    const res = await request(app).patch('/admin/business-profiles/b1').send({ storefront_status: 'approved' });
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      storefront_status: 'approved', reviewed_by: 'admin-1', rejection_reason: null,
    }));
  });

  it('edits store details without touching status', async () => {
    const updateBuilder = makeBuilder({ data: { id: 'b1', store_suburb: 'Parramatta' }, error: null });
    queueFrom(updateBuilder, makeBuilder());
    const res = await request(app).patch('/admin/business-profiles/b1').send({ store_suburb: 'Parramatta' });
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.not.objectContaining({ reviewed_by: expect.anything() }));
  });

  it('rejects an empty body', async () => {
    const res = await request(app).patch('/admin/business-profiles/b1').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid storefront_status', async () => {
    const res = await request(app).patch('/admin/business-profiles/b1').send({ storefront_status: 'live' });
    expect(res.status).toBe(400);
  });
});
