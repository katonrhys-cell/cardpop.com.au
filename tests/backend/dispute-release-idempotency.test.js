import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// PATCH /admin/disputes/:id 'release' used to pay first and mark resolved
// after, with no terminal-status check and no Stripe idempotency key — so a
// double click, a retry or two admins at once paid the seller twice. It now
// 409s a resolved dispute, claims the resolution with a conditional update
// before any money moves, keys the transfer, and re-opens the dispute if the
// payout fails so it can be retried.

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockPayoutSeller = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: { transfers: { create: vi.fn() } } }));
vi.mock('../../src/services/payoutService.js', () => ({ payoutSeller: mockPayoutSeller }));
vi.mock('../../src/services/refundAmounts.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getRefundRetentionPct: vi.fn(async () => 50),
}));
vi.mock('../../src/utils/emailService.js', () => ({ sendOrderShipped: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
  isAdminUser: vi.fn(async () => true),
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  default: (_req, _res, next) => next(),
}));

import adminRouter from '../../src/routes/admin.js';

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

function makeBuilder(result = { data: null, error: null }) {
  const b = { calls: [] };
  for (const m of ['select', 'update', 'insert', 'eq', 'is', 'not', 'order', 'limit']) {
    b[m] = vi.fn((...args) => { b.calls.push([m, ...args]); return b; });
  }
  b.single = vi.fn(() => Promise.resolve(result));
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

const OPEN_DISPUTE = { id: 'd1', order_id: 'o1', status: 'needs_response', resolved_at: null, resolution_notes: null };
const SINGLE_ORDER = { id: 'o1', seller_id: 's1', listing_id: 'l1', seller_proceeds_aud: 230, order_items: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.from.mockReset();
  mockPayoutSeller.mockResolvedValue({ status: 'transferred', transferId: 'tr_x' });
});

describe('PATCH /admin/disputes/:id — release idempotency', () => {
  it('409s a dispute that is already resolved, without paying', async () => {
    queueFrom(makeBuilder({ data: { ...OPEN_DISPUTE, status: 'resolved_released', resolved_at: '2026-10-01T00:00:00Z' }, error: null }));
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });
    expect(res.status).toBe(409);
    expect(mockPayoutSeller).not.toHaveBeenCalled();
  });

  it('409s a released dispute whose status Stripe later overwrote (resolved_at still set)', async () => {
    queueFrom(makeBuilder({ data: { ...OPEN_DISPUTE, status: 'won', resolved_at: '2026-10-01T00:00:00Z' }, error: null }));
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });
    expect(res.status).toBe(409);
    expect(mockPayoutSeller).not.toHaveBeenCalled();
  });

  it('409s when a concurrent request wins the claim (no row back), without paying', async () => {
    queueFrom(
      makeBuilder({ data: OPEN_DISPUTE, error: null }),
      makeBuilder({ data: SINGLE_ORDER, error: null }),
      makeBuilder({ data: null, error: null }), // conditional claim matched nothing
    );
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });
    expect(res.status).toBe(409);
    expect(mockPayoutSeller).not.toHaveBeenCalled();
  });

  it('claims the dispute conditionally BEFORE paying, and keys the transfer', async () => {
    const claim = makeBuilder({ data: { ...OPEN_DISPUTE, status: 'resolved_released' }, error: null });
    let claimedBeforePay = false;
    mockPayoutSeller.mockImplementation(async () => {
      claimedBeforePay = claim.update.mock.calls.length === 1;
      return { status: 'transferred', transferId: 'tr_x' };
    });
    queueFrom(makeBuilder({ data: OPEN_DISPUTE, error: null }), makeBuilder({ data: SINGLE_ORDER, error: null }), claim);

    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });

    expect(res.status).toBe(200);
    expect(res.body.dispute.status).toBe('resolved_released');
    expect(claimedBeforePay).toBe(true);
    expect(claim.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved_released', resolved_by: 'admin-1' }));
    expect(claim.eq).toHaveBeenCalledWith('status', 'needs_response');
    expect(claim.is).toHaveBeenCalledWith('resolved_at', null);
    expect(mockPayoutSeller).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      sellerId: 's1', sellerProceeds: 230, orderId: 'o1', idempotencyKey: 'dispute-release-d1',
    }));
  });

  it('re-opens the dispute (so it can be retried) when the payout fails', async () => {
    mockPayoutSeller.mockResolvedValue({ status: 'failed' });
    const undo = makeBuilder({ data: null, error: null });
    queueFrom(
      makeBuilder({ data: OPEN_DISPUTE, error: null }),
      makeBuilder({ data: SINGLE_ORDER, error: null }),
      makeBuilder({ data: { ...OPEN_DISPUTE, status: 'resolved_released' }, error: null }),
      undo,
    );

    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });

    expect(res.status).toBe(502);
    expect(undo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'needs_response', resolved_at: null, resolved_by: null }));
    expect(undo.eq).toHaveBeenCalledWith('status', 'resolved_released');
  });

  it('re-opens the dispute when the payout throws', async () => {
    mockPayoutSeller.mockRejectedValue(new Error('stripe down'));
    const undo = makeBuilder({ data: null, error: null });
    queueFrom(
      makeBuilder({ data: OPEN_DISPUTE, error: null }),
      makeBuilder({ data: SINGLE_ORDER, error: null }),
      makeBuilder({ data: { ...OPEN_DISPUTE, status: 'resolved_released' }, error: null }),
      undo,
    );

    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });

    expect(res.status).toBe(500);
    expect(undo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'needs_response', resolved_at: null }));
  });

  it('on a cart retry, pays only the lines that did not go out the first time', async () => {
    const lines = [
      { id: 'l1', seller_id: 's1', payout: { status: 'transferred', transferId: 'tr_1', proceeds: 40, releasedForDispute: 'd1' } },
      { id: 'l2', seller_id: 's2', payout: { status: 'wallet_credited', transferId: null, proceeds: 25 } },
    ];
    const ordersUpdate = makeBuilder({ error: null });
    queueFrom(
      makeBuilder({ data: OPEN_DISPUTE, error: null }),
      makeBuilder({ data: { id: 'o1', seller_id: null, listing_id: null, seller_proceeds_aud: null, order_items: lines }, error: null }),
      makeBuilder({ data: { ...OPEN_DISPUTE, status: 'resolved_released' }, error: null }),
      ordersUpdate,
    );
    mockPayoutSeller.mockResolvedValueOnce({ status: 'wallet_credited' });

    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'release' });

    expect(res.status).toBe(200);
    expect(mockPayoutSeller).toHaveBeenCalledTimes(1);
    expect(mockPayoutSeller).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      sellerId: 's2', sellerProceeds: 25, idempotencyKey: 'dispute-release-d1-l2',
    }));
    const saved = ordersUpdate.update.mock.calls[0][0].order_items;
    expect(saved.find((l) => l.id === 'l2').payout.releasedForDispute).toBe('d1');
  });

  it('keep_frozen also claims atomically and never pays', async () => {
    const claim = makeBuilder({ data: { ...OPEN_DISPUTE, status: 'resolved_kept' }, error: null });
    queueFrom(makeBuilder({ data: OPEN_DISPUTE, error: null }), claim);
    const res = await request(app).patch('/admin/disputes/d1').send({ action: 'keep_frozen' });
    expect(res.status).toBe(200);
    expect(claim.is).toHaveBeenCalledWith('resolved_at', null);
    expect(mockPayoutSeller).not.toHaveBeenCalled();
  });
});
