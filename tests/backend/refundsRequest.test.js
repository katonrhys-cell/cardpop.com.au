import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// POST /refunds/request — the buyer's quote. It must use the same arithmetic as
// admin approval and processRefund (a full refund by default), and the same
// claim window as the Request Refund button (utils/buyerProtectionPolicy.js).
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'buyer-1' }; next(); },
}));
const policy = vi.hoisted(() => ({ retentionPct: 0, retainProcessingFee: false }));
vi.mock('../../src/services/refundAmounts.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getRefundPolicyOptions: vi.fn(async () => ({ ...policy })),
}));

import refundsRouter from '../../src/routes/refunds.js';

function builder(result = { data: null, error: null }) {
  const b = {};
  for (const m of ['select', 'insert', 'update', 'eq']) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
  return b;
}

const app = express();
app.use(express.json());
app.use('/refunds', refundsRouter);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
// Posted 10 days ago → auto-delivered today → inside the 7-day window.
const baseOrder = { id: 'o1', buyer_id: 'buyer-1', status: 'payment_confirmed', refund_status: null, item_price_aud: 0, gst_aud: 0, created_at: daysAgo(12), shipped_at: daysAgo(10) };

async function requestRefund(order) {
  const insert = builder();
  mockSupabase.from
    .mockReturnValueOnce(builder({ data: order, error: null })) // orders select
    .mockReturnValueOnce(insert)                                 // refunds insert
    .mockReturnValueOnce(builder())                              // orders update
    .mockReturnValue(builder());                                 // seller notification
  const res = await request(app).post('/refunds/request').send({ orderId: 'o1', reason: 'damaged' });
  return { res, insert };
}

beforeEach(() => { mockSupabase.from.mockReset(); policy.retentionPct = 0; policy.retainProcessingFee = false; });

describe('POST /refunds/request — quoted amount', () => {
  it('quotes a CardPop Shop order in full', async () => {
    const { res, insert } = await requestRefund({
      ...baseOrder, seller_id: null, total_aud: 51.37, platform_fee_aud: 0, processing_fee_aud: 1.32,
      order_items: [{ type: 'shop', id: 'p1', seller_id: null, line_total_aud: 40.05 }],
    });
    expect(res.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ retained_fee_aud: 0, refund_amount_aud: 51.37 }));
  });

  it('quotes a marketplace order in full by default', async () => {
    const { res, insert } = await requestRefund({
      ...baseOrder, seller_id: 'seller-1', total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3,
    });
    expect(res.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ retained_fee_aud: 0, refund_amount_aud: 112.3 }));
  });

  it('applies admin-configured retention when set', async () => {
    policy.retentionPct = 50; policy.retainProcessingFee = true;
    const { res, insert } = await requestRefund({
      ...baseOrder, seller_id: 'seller-1', total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3,
    });
    expect(res.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ retained_fee_aud: 7.3, refund_amount_aud: 105 }));
  });
});

describe('POST /refunds/request — claim window', () => {
  it('refuses a claim on an unposted order inside the seller’s posting allowance', async () => {
    const { res, insert } = await requestRefund({ ...baseOrder, seller_id: 'seller-1', total_aud: 50, created_at: daysAgo(2), shipped_at: null });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFUND_WINDOW_NOT_OPEN');
    expect(insert.insert).not.toHaveBeenCalled();
  });

  it('accepts a not-received claim once the posting allowance has passed', async () => {
    const { res } = await requestRefund({ ...baseOrder, seller_id: 'seller-1', total_aud: 50, created_at: daysAgo(9), shipped_at: null });
    expect(res.status).toBe(200);
  });

  it('refuses a claim after the window has closed', async () => {
    const { res } = await requestRefund({ ...baseOrder, seller_id: 'seller-1', total_aud: 50, created_at: daysAgo(40), shipped_at: daysAgo(38) });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFUND_WINDOW_CLOSED');
  });

  it('refuses anything past the hard cap, even unposted', async () => {
    const { res } = await requestRefund({ ...baseOrder, seller_id: 'seller-1', total_aud: 50, created_at: daysAgo(46), shipped_at: null });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFUND_WINDOW_CLOSED');
  });
});
