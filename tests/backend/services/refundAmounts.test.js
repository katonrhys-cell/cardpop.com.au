import { describe, it, expect } from 'vitest';
import { computeRefundAmounts, DEFAULT_REFUND_FEE_RETENTION_PCT } from '../../../src/services/refundAmounts.js';

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
});
