// Regression tests for the bugs fixed in the 2026-11-10 audit.
import { describe, it, expect } from 'vitest';
import { isDeliveredDescription } from '../../src/utils/carrierTracking.js';
import { NON_COUNTING_STATUSES } from '../../src/utils/purchaseVelocity.js';
import { refundWindow } from '../../utils/buyerProtectionPolicy.js';

describe('carrier "delivered" detection', () => {
  it.each([
    'Delivered',
    'Delivered - Left in a safe place',
    'Item delivered',
    'Your parcel has been delivered',
  ])('treats %j as delivered', (text) => {
    expect(isDeliveredDescription(text)).toBe(true);
  });

  // Each of these contains the word "delivered" and used to complete the
  // order and start the Buyer Protection clock.
  it.each([
    'Cannot be delivered',
    'To be delivered today',
    'Scheduled to be delivered',
    'Partially delivered',
    'Delivery attempted',
    'Out for delivery',
  ])('does not treat %j as delivered', (text) => {
    expect(isDeliveredDescription(text)).toBe(false);
  });
});

describe('purchase velocity', () => {
  it('does not count unpaid (pending) checkouts against a new buyer', () => {
    expect(NON_COUNTING_STATUSES.has('pending')).toBe(true);
    expect(NON_COUNTING_STATUSES.has('payment_confirmed')).toBe(false);
  });
});

describe('shop refund window', () => {
  const shopOrder = (extra) => ({ order_items: [{ type: 'shop', id: 'p1' }], ...extra });

  it('stays open on a pre-order that has not shipped, however long ago it was paid', () => {
    const paid = new Date('2026-01-01T00:00:00Z');
    const w = refundWindow(shopOrder({ created_at: paid.toISOString() }), new Date('2026-06-01T00:00:00Z'));
    expect(w.state).toBe('open');
    expect(w.closesAt).toBeNull();
  });

  it('still closes 14 days after delivery', () => {
    const order = shopOrder({ created_at: '2026-01-01T00:00:00Z', delivered_at: '2026-01-10T00:00:00Z' });
    expect(refundWindow(order, new Date('2026-01-20T00:00:00Z')).state).toBe('open');
    expect(refundWindow(order, new Date('2026-01-25T00:00:00Z')).state).toBe('closed');
  });
});
