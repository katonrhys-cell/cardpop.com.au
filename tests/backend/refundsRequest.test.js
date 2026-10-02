import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// POST /refunds/request — the buyer's quote. It must use the same arithmetic as
// admin approval and processRefund: marketplace orders retain fees, CardPop
// Shop orders (no restocking fee) are quoted their whole total.
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'buyer-1' }; next(); },
}));
vi.mock('../../src/services/refundAmounts.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getRefundRetentionPct: vi.fn(async () => 50),
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

const baseOrder = { id: 'o1', buyer_id: 'buyer-1', status: 'payment_confirmed', refund_status: null, item_price_aud: 0, gst_aud: 0 };

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

beforeEach(() => { mockSupabase.from.mockReset(); });

describe('POST /refunds/request — quoted amount', () => {
  it('quotes a CardPop Shop order in full', async () => {
    const { res, insert } = await requestRefund({
      ...baseOrder, seller_id: null, total_aud: 51.37, platform_fee_aud: 0, processing_fee_aud: 1.32,
      order_items: [{ type: 'shop', id: 'p1', seller_id: null, line_total_aud: 40.05 }],
    });
    expect(res.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ retained_fee_aud: 0, refund_amount_aud: 51.37 }));
  });

  it('still retains fees on a marketplace order', async () => {
    const { res, insert } = await requestRefund({
      ...baseOrder, seller_id: 'seller-1', total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3,
    });
    expect(res.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ retained_fee_aud: 7.3, refund_amount_aud: 105 }));
  });
});
