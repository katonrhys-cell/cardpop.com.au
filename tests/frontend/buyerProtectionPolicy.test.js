import { describe, it, expect } from 'vitest';
import { MARKETPLACE_PROTECTION, refundWindow, daysLeftInWindow, effectiveDeliveredAt, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 12)); // 1 Oct 2026 + n days, noon UTC
const marketplace = (extra = {}) => ({ created_at: day(0).toISOString(), order_items: [{ type: 'listing' }], ...extra });
const shop = (extra = {}) => ({ created_at: day(0).toISOString(), order_items: [{ type: 'shop' }], ...extra });

describe('refundWindow — marketplace', () => {
  it('is too early to claim on an unshipped order inside the posting allowance', () => {
    const w = refundWindow(marketplace(), day(3));
    expect(w.state).toBe('not_yet');
    expect(w.opensAt).toEqual(day(MARKETPLACE_PROTECTION.notShippedClaimAfterDays));
  });

  it('opens a not-received claim once the posting allowance passes with no shipped mark', () => {
    const w = refundWindow(marketplace(), day(8));
    expect(w.state).toBe('open');
    expect(w.closesAt).toEqual(day(MARKETPLACE_PROTECTION.hardCapDaysFromPurchase));
  });

  it('runs 7 days from a recorded delivery', () => {
    const o = marketplace({ shipped_at: day(2).toISOString(), delivered_at: day(5).toISOString() });
    expect(refundWindow(o, day(6)).state).toBe('open');
    expect(refundWindow(o, day(12)).state).toBe('open');
    expect(refundWindow(o, day(12) ).closesAt).toEqual(day(12));
    expect(refundWindow(o, day(13)).state).toBe('closed');
  });

  it('auto-delivers 10 days after posting when nothing records delivery, then runs 7 days', () => {
    const o = marketplace({ shipped_at: day(2).toISOString() });
    expect(effectiveDeliveredAt(o)).toEqual(day(12));
    expect(refundWindow(o, day(5)).state).toBe('not_yet');   // in transit, under a week since posting
    expect(refundWindow(o, day(10)).state).toBe('open');     // a week since posting, still not here → not received
    expect(refundWindow(o, day(18)).state).toBe('open');     // delivered (auto) day 12 + 6
    expect(refundWindow(o, day(20)).state).toBe('closed');   // day 12 + 7 passed
  });

  it('never opens after the hard cap, whatever the shipping state', () => {
    expect(refundWindow(marketplace(), day(46)).state).toBe('closed');
    const late = marketplace({ shipped_at: day(40).toISOString() });
    expect(refundWindow(late, day(46)).state).toBe('closed');
  });

  it('caps a late delivery window at the hard cap', () => {
    const o = marketplace({ shipped_at: day(30).toISOString(), delivered_at: day(43).toISOString() });
    expect(refundWindow(o, day(44)).closesAt).toEqual(day(45));
  });
});

describe('refundWindow — shop', () => {
  it('accepts a problem report from day one and runs 14 days from delivery', () => {
    const o = shop({ delivered_at: day(4).toISOString() });
    expect(refundWindow(o, day(1)).state).toBe('open');
    expect(refundWindow(o, day(18)).state).toBe('open');
    expect(refundWindow(o, day(19)).state).toBe('closed');
  });
});

describe('daysLeftInWindow', () => {
  it('counts whole days remaining and 0 when closed', () => {
    const w = refundWindow(marketplace({ delivered_at: day(5).toISOString() }), day(9));
    expect(daysLeftInWindow(w, day(9))).toBe(3);
    expect(daysLeftInWindow({ state: 'closed', closesAt: day(1) }, day(9))).toBe(0);
  });
});

describe('copy', () => {
  it('states the numbers it is built from', () => {
    expect(PROTECTION_COPY.marketplaceSummary).toContain('within 7 days of delivery');
    expect(PROTECTION_COPY.marketplaceSummary).toContain('refunded in full');
    expect(PROTECTION_COPY.notShippedSummary).toContain('45 days after purchase');
    expect(PROTECTION_COPY.shopSummary).toContain('14 days of delivery');
  });
});
