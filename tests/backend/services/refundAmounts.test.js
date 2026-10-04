import { describe, it, expect } from 'vitest';
import { computeRefundAmounts, isShopOrder, DEFAULT_REFUND_FEE_RETENTION_PCT, DEFAULT_REFUND_RETAIN_PROCESSING_FEE } from '../../../src/services/refundAmounts.js';

// The buyer-request estimate, the admin approval figure and the amount sent to
// Stripe all go through this one function — these pin the arithmetic so the
// three can't drift apart again.
//
// Policy (utils/buyerProtectionPolicy.js): an approved refund is a FULL refund
// by default. The retention knobs still work when an admin sets them.
describe('computeRefundAmounts — defaults', () => {
  it('refunds a marketplace order in full: item, postage, service fee and processing fee', () => {
    expect(DEFAULT_REFUND_FEE_RETENTION_PCT).toBe(0);
    expect(DEFAULT_REFUND_RETAIN_PROCESSING_FEE).toBe(false);
    const r = computeRefundAmounts({ total_aud: 115.5, platform_fee_aud: 3, processing_fee_aud: 2.5 });
    expect(r).toMatchObject({ orderTotal: 115.5, shopOrder: false, retentionPct: 0, retainedCommission: 0, processingFee: 0, retainedFee: 0, refundAmount: 115.5 });
  });

  it('refunds a marketplace-only cart order in full too', () => {
    const r = computeRefundAmounts({
      total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3,
      order_items: [{ type: 'listing', line_total_aud: 100, commission_aud: 10 }],
    });
    expect(r).toMatchObject({ retainedFee: 0, refundAmount: 112.3 });
  });

  it('falls back to the (full-refund) default when the percentage is not a number', () => {
    const r = computeRefundAmounts({ total_aud: 100, platform_fee_aud: 10 }, 'abc');
    expect(r).toMatchObject({ retentionPct: 0, refundAmount: 100 });
  });
});

describe('computeRefundAmounts — admin-configured retention', () => {
  it('retains the configured share of the platform fee', () => {
    const r = computeRefundAmounts({ total_aud: 110, platform_fee_aud: 10 }, 50);
    expect(r).toMatchObject({ orderTotal: 110, retainedCommission: 5, processingFee: 0, retainedFee: 5, refundAmount: 105 });
  });

  it('keeps the processing fee only when that knob is on', () => {
    const order = { total_aud: 112.3, platform_fee_aud: 10, processing_fee_aud: 2.3 };
    expect(computeRefundAmounts(order, 50)).toMatchObject({ processingFee: 0, retainedFee: 5, refundAmount: 107.3 });
    expect(computeRefundAmounts(order, 50, { retainProcessingFee: true })).toMatchObject({ retainedCommission: 5, processingFee: 2.3, retainedFee: 7.3, refundAmount: 105 });
  });

  it('honours a non-default retention percentage', () => {
    const r = computeRefundAmounts({ total_aud: 107.5, platform_fee_aud: 5, processing_fee_aud: 2.39 }, 100, { retainProcessingFee: true });
    expect(r).toMatchObject({ retainedCommission: 5, retainedFee: 7.39, refundAmount: 100.11 });
  });

  it('never lets a negative processing fee inflate the refund', () => {
    const r = computeRefundAmounts({ total_aud: 100, platform_fee_aud: 10, processing_fee_aud: -3 }, 50, { retainProcessingFee: true });
    expect(r).toMatchObject({ processingFee: 0, refundAmount: 95 });
  });
});

// CardPop Shop return policy (Google Merchant Center): no restocking fee. A
// shop order must come back in full — total_aud, every cent — whatever the knobs say.
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
    const r = computeRefundAmounts(shopOrder, 50, { retainProcessingFee: true });
    expect(r).toMatchObject({ shopOrder: true, retainedCommission: 0, processingFee: 0, retainedFee: 0, refundAmount: 51.37 });
  });

  it('ignores the retention percentage for shop orders', () => {
    const r = computeRefundAmounts({ ...shopOrder, platform_fee_aud: 4 }, 100, { retainProcessingFee: true });
    expect(r).toMatchObject({ retainedFee: 0, refundAmount: 51.37 });
  });

  it('a mixed cart, when retention is configured, keeps the commission share and only the marketplace part of the processing fee', () => {
    // $60 shop goods + $10 shop shipping, $100 card + $10 seller postage, $10
    // commission → pre-fee $190; marketplace share = (100 + 10 + 10) / 190.
    const r = computeRefundAmounts({
      total_aud: 193.8, platform_fee_aud: 10, processing_fee_aud: 3.8,
      order_items: [
        { type: 'shop', line_total_aud: 60 },
        { type: 'listing', line_total_aud: 100, shipping_aud: 10, commission_aud: 10 },
      ],
    }, 50, { retainProcessingFee: true });
    expect(r.shopOrder).toBe(false);
    expect(r.retainedCommission).toBe(5);
    expect(r.processingFee).toBe(2.4); // 3.80 × 120/190
    expect(r).toMatchObject({ retainedFee: 7.4, refundAmount: 186.4 });
  });
});
