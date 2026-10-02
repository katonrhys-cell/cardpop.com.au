import { describe, it, expect } from 'vitest';
import { computeRefundAmounts, isShopOrder, DEFAULT_REFUND_FEE_RETENTION_PCT } from '../../../src/services/refundAmounts.js';

// The buyer-request estimate, the admin approval figure and the amount sent to
// Stripe all go through this one function — these pin the arithmetic so the
// three can't drift apart again.
describe('computeRefundAmounts', () => {
  it('retains the configured share of the platform fee', () => {
    const r = computeRefundAmounts({ total_aud: 110, platform_fee_aud: 10 }, 50);
    expect(r).toMatchObject({ orderTotal: 110, retainedCommission: 5, processingFee: 0, retainedFee: 5, refundAmount: 105 });
  });

  it('retains the processing fee in full on top of the commission share', () => {
    const r = computeRefundAmounts({ total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3 }, 50);
    expect(r).toMatchObject({ retainedCommission: 5, processingFee: 2.3, retainedFee: 7.3, refundAmount: 105 });
  });

  it('honours a non-default retention percentage', () => {
    const r = computeRefundAmounts({ total_aud: 107.5, platform_fee_aud: 5, processing_fee_aud: 2.39 }, 100);
    expect(r).toMatchObject({ retainedCommission: 5, retainedFee: 7.39, refundAmount: 100.11 });
  });

  it('treats a pre-fee order (no processing_fee_aud) exactly as before', () => {
    const r = computeRefundAmounts({ total_aud: 100, platform_fee_aud: 10 });
    expect(r.retentionPct).toBe(DEFAULT_REFUND_FEE_RETENTION_PCT);
    expect(r).toMatchObject({ retainedFee: 5, refundAmount: 95 });
  });

  it('falls back to the default when the percentage is not a number', () => {
    const r = computeRefundAmounts({ total_aud: 100, platform_fee_aud: 10 }, 'abc');
    expect(r).toMatchObject({ retentionPct: 50, refundAmount: 95 });
  });

  it('never lets a negative processing fee inflate the refund', () => {
    const r = computeRefundAmounts({ total_aud: 100, platform_fee_aud: 10, processing_fee_aud: -3 }, 50);
    expect(r).toMatchObject({ processingFee: 0, refundAmount: 95 });
  });

  it('retains fees on a marketplace-only cart order (listing lines)', () => {
    const r = computeRefundAmounts({
      total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3,
      order_items: [{ type: 'listing', line_total_aud: 100, commission_aud: 10 }],
    }, 50);
    expect(r).toMatchObject({ shopOrder: false, retainedCommission: 5, processingFee: 2.3, retainedFee: 7.3, refundAmount: 105 });
  });
});

// CardPop Shop return policy (Google Merchant Center): no restocking fee. A
// shop order must come back in full — total_aud, every cent.
describe('computeRefundAmounts — CardPop Shop orders', () => {
  const shopOrder = {
    total_aud: 51.37, platform_fee_aud: 0, processing_fee_aud: 1.32,
    order_items: [
      { type: 'shop', id: 'p1', seller_id: null, quantity: 2, line_total_aud: 30, commission_aud: 0 },
      { type: 'shop', id: 'p2', seller_id: null, quantity: 1, line_total_aud: 10.05, commission_aud: 0 },
    ],
  };

  it('identifies an order whose lines are all shop products', () => {
    expect(isShopOrder(shopOrder)).toBe(true);
    expect(isShopOrder({ total_aud: 100 })).toBe(false); // single-item marketplace purchase
    expect(isShopOrder({ order_items: [] })).toBe(false);
    expect(isShopOrder({ order_items: [{ type: 'shop' }, { type: 'listing' }] })).toBe(false);
  });

  it('refunds total_aud in full — no processing-fee or platform-fee retention', () => {
    const r = computeRefundAmounts(shopOrder, 50);
    expect(r).toMatchObject({ shopOrder: true, retainedCommission: 0, processingFee: 0, retainedFee: 0, refundAmount: 51.37 });
  });

  it('ignores the retention percentage for shop orders', () => {
    const r = computeRefundAmounts({ ...shopOrder, platform_fee_aud: 4 }, 100);
    expect(r).toMatchObject({ retainedFee: 0, refundAmount: 51.37 });
  });

  it('a mixed cart keeps the commission share and only the marketplace part of the processing fee', () => {
    // $60 shop goods + $10 shop shipping, $100 card + $10 seller postage, $10
    // commission → pre-fee $190; marketplace share = (100 + 10 + 10) / 190.
    const r = computeRefundAmounts({
      total_aud: 193.8, platform_fee_aud: 10, processing_fee_aud: 3.8,
      order_items: [
        { type: 'shop', line_total_aud: 60 },
        { type: 'listing', line_total_aud: 100, shipping_aud: 10, commission_aud: 10 },
      ],
    }, 50);
    expect(r.shopOrder).toBe(false);
    expect(r.retainedCommission).toBe(5);
    expect(r.processingFee).toBe(2.4); // 3.80 × 120/190
    expect(r).toMatchObject({ retainedFee: 7.4, refundAmount: 186.4 });
  });
});
