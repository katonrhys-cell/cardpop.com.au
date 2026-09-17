import { vi, describe, it, expect, beforeEach } from 'vitest';

// refundService.processRefund is an admin-only (req,res) handler that touches
// Stripe, Supabase, payouts, wallet credit and email. Mock every collaborator so
// we can assert the authorization guards, the state-gating guards and the
// server-authoritative fee-retention math without any live calls.
const mockStripe = vi.hoisted(() => ({
  refunds: { create: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
}));
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockGetPlatformSetting = vi.hoisted(() => vi.fn());
const mockReverseSellerPayout = vi.hoisted(() => vi.fn());
const mockCreditWallet = vi.hoisted(() => vi.fn());
const mockIsAdminUser = vi.hoisted(() => vi.fn());
const mockEmail = vi.hoisted(() => ({ sendRefundProcessed: vi.fn(), sendRefundIssued: vi.fn() }));

vi.mock('../../../src/utils/stripeClient.js', () => ({ default: mockStripe }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/emailService.js', () => mockEmail);
vi.mock('../../../src/services/payoutService.js', () => ({ reverseSellerPayout: mockReverseSellerPayout }));
vi.mock('../../../src/services/walletService.js', () => ({ creditWallet: mockCreditWallet }));
vi.mock('../../../src/services/stripeWebhookService.js', () => ({ getPlatformSetting: mockGetPlatformSetting }));
vi.mock('../../../src/middleware/auth.js', () => ({ isAdminUser: mockIsAdminUser }));

import { processRefund } from '../../../src/services/refundService.js';

// Chainable Supabase query stub. `single` feeds .maybeSingle(); `value` feeds a
// direct await on the chain (e.g. update().eq().select()).
function builder({ single = { data: null, error: null }, value = { data: null, error: null } } = {}) {
  const b = {};
  for (const m of ['select', 'update', 'insert', 'eq', 'order', 'limit']) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(single));
  b.then = (onF, onR) => Promise.resolve(value).then(onF, onR);
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
  mockGetPlatformSetting.mockResolvedValue(50); // refund_fee_retention_pct default
  mockReverseSellerPayout.mockResolvedValue({ action: 'none' });
});

describe('processRefund — authorization & state guards', () => {
  it('rejects a non-admin caller with 403 and never reads the refund', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 404 when the refund row is missing', async () => {
    queueFrom(builder({ single: { data: null, error: null } }));
    const res = makeRes();
    await processRefund({ body: { refundId: 'nope' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when the refund is not in the approved state', async () => {
    queueFrom(builder({ single: { data: { id: 'r1', status: 'pending', order: {} }, error: null } }));
    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the order is already refunded', async () => {
    queueFrom(builder({ single: { data: { id: 'r1', status: 'approved', order: { status: 'refunded' } }, error: null } }));
    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when the order payout is frozen/reversed by an open dispute', async () => {
    queueFrom(builder({ single: { data: { id: 'r1', status: 'approved', order: { status: 'paid', payout_status: 'frozen' } }, error: null } }));
    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockStripe.refunds.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the order has no Stripe payment intent', async () => {
    queueFrom(builder({ single: { data: { id: 'r1', status: 'approved', order: { status: 'paid', stripe_payment_intent_id: null } }, error: null } }));
    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('processRefund — fee retention math (happy path)', () => {
  const refundRow = {
    id: 'r1',
    status: 'approved',
    order_id: 'o1',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    order: {
      id: 'o1',
      status: 'paid',
      payout_status: 'paid',
      stripe_payment_intent_id: 'pi_123',
      stripe_session_id: null,
      total_aud: 110,
      platform_fee_aud: 10, // commission + GST
    },
  };

  it('retains 50% of the commission and refunds the remainder via Stripe', async () => {
    queueFrom(
      builder({ single: { data: refundRow, error: null } }),          // refunds select
      builder({ value: { data: [{ id: 'r1' }], error: null } }),      // refunds claim (approved -> processing)
      builder({ value: { data: null, error: null } }),                // refunds -> processed
      builder({ value: { data: null, error: null } }),                // orders -> refunded
      builder({ value: { data: null, error: null } }),                // notifications (buyer)
      builder({ value: { data: null, error: null } }),                // notifications (seller)
      builder({ single: { data: { email: 'buyer@x.com', display_name: 'Buyer' }, error: null } }),  // profiles buyer
      builder({ single: { data: { email: 'seller@x.com', display_name: 'Seller' }, error: null } }), // profiles seller
    );
    mockStripe.refunds.create.mockResolvedValue({ id: 're_1' });

    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);

    // retainedFee = 10 * 50% = 5 ; refundAmount = 110 - 5 = 105
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_123', amount: 10500 }),
      { idempotencyKey: 'refund_order_o1' },
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true, stripeRefundId: 're_1', refundAmount: 105, retainedFee: 5,
    }));
    expect(mockEmail.sendRefundProcessed).toHaveBeenCalledWith(expect.objectContaining({ refundAmount: 105 }));
    expect(mockEmail.sendRefundIssued).toHaveBeenCalledWith(expect.objectContaining({ retainedFee: 5 }));
  });

  it('retains the processing fee IN FULL on top of the commission share', async () => {
    // Stripe keeps its fee on a refunded charge, so refunding the buyer's
    // reimbursement of it would make every refund a loss for the platform.
    queueFrom(
      builder({ single: { data: { ...refundRow, order: { ...refundRow.order, total_aud: 112.3, processing_fee_aud: 2.3 } }, error: null } }),
      builder({ value: { data: [{ id: 'r1' }], error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ single: { data: { email: 'buyer@x.com', display_name: 'Buyer' }, error: null } }),
      builder({ single: { data: { email: 'seller@x.com', display_name: 'Seller' }, error: null } }),
    );
    mockStripe.refunds.create.mockResolvedValue({ id: 're_2' });

    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);

    // retained = (10 × 50%) + 2.30 = 7.30 ; refund = 112.30 − 7.30 = 105.00
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10500 }),
      { idempotencyKey: 'refund_order_o1' },
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ refundAmount: 105, retainedFee: 7.3 }));
  });

  it('treats a pre-fee order (no processing_fee_aud) exactly as before', async () => {
    queueFrom(
      builder({ single: { data: refundRow, error: null } }),
      builder({ value: { data: [{ id: 'r1' }], error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ value: { data: null, error: null } }),
      builder({ single: { data: { email: 'buyer@x.com', display_name: 'Buyer' }, error: null } }),
      builder({ single: { data: { email: 'seller@x.com', display_name: 'Seller' }, error: null } }),
    );
    mockStripe.refunds.create.mockResolvedValue({ id: 're_3' });

    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ refundAmount: 105, retainedFee: 5 }));
  });

  it('returns 409 without calling Stripe when the approved->processing claim wins zero rows (concurrent processing)', async () => {
    queueFrom(
      builder({ single: { data: refundRow, error: null } }),      // refunds select
      builder({ value: { data: [], error: null } }),              // refunds claim -> no rows (already processing)
    );
    const res = makeRes();
    await processRefund({ body: { refundId: 'r1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockStripe.refunds.create).not.toHaveBeenCalled();
  });
});
