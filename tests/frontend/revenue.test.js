import { describe, it, expect } from 'vitest';
import {
  PAID_ORDER_STATUSES,
  isPaidOrder,
  orderGst,
  orderChannel,
  orderItemCount,
  summariseRevenue,
  bucketRevenue,
  revenueByChannel,
  revenueByStatus,
  filterOrdersByRange,
  startOfAustralianFinancialYear,
  formatAud,
} from '@/utils/revenue.js';

// Mirrors the real payment_confirmed cart order in production: four GST-
// inclusive shop lines plus $10 flat shipping = $50.96.
const shopOrder = {
  id: 'order-shop',
  status: 'payment_confirmed',
  created_at: '2026-09-13T01:03:19.165Z',
  item_price_aud: '40.96',
  shipping_aud: '10.00',
  platform_fee_aud: '0.00',
  gst_aud: '0.00',
  gst_included_aud: '4.63',
  discount_aud: '0',
  total_aud: '50.96',
  transaction_type: 'cart',
  order_items: [
    { id: 'a', type: 'shop', title: 'Top Loaders', quantity: 1, line_total_aud: 9.99 },
    { id: 'b', type: 'shop', title: 'Team Bags', quantity: 2, line_total_aud: 5.99 },
  ],
};

const marketplaceOrder = {
  id: 'order-mkt',
  status: 'completed',
  created_at: '2026-08-02T04:00:00.000Z',
  item_price_aud: '10.00',
  shipping_aud: '0.00',
  platform_fee_aud: '1.33',
  gst_aud: '1.03',
  gst_included_aud: '0',
  discount_aud: '0',
  total_aud: '11.33',
  transaction_type: 'cart',
  order_items: [{ id: 'c', type: 'listing', title: 'Charizard', quantity: 1, line_total_aud: 10 }],
};

const unpaidOrders = [
  { id: 'p1', status: 'pending', created_at: '2026-09-01T00:00:00.000Z', total_aud: '99.00' },
  { id: 'c1', status: 'cancelled', created_at: '2026-09-02T00:00:00.000Z', total_aud: '11.33' },
  { id: 'f1', status: 'payment_failed', created_at: '2026-09-03T00:00:00.000Z', total_aud: '500.00' },
];

describe('paid order statuses', () => {
  it('counts every status where the buyer was actually charged', () => {
    // 'delivered' was the bug: a real status that both admin revenue readouts
    // silently dropped, so a fulfilled order vanished from lifetime revenue.
    expect(PAID_ORDER_STATUSES).toContain('delivered');
    expect(PAID_ORDER_STATUSES).toContain('payment_confirmed');
    expect(PAID_ORDER_STATUSES).toContain('shipped');
    expect(PAID_ORDER_STATUSES).toContain('completed');
    expect(PAID_ORDER_STATUSES).toContain('refunded');
  });

  it('excludes statuses that never took a payment', () => {
    unpaidOrders.forEach((o) => expect(isPaidOrder(o)).toBe(false));
  });
});

describe('summariseRevenue', () => {
  it('sums only paid orders', () => {
    const s = summariseRevenue([shopOrder, marketplaceOrder, ...unpaidOrders]);
    expect(s.orderCount).toBe(2);
    expect(s.gross).toBe(62.29);
    expect(s.itemSubtotal).toBe(50.96);
    expect(s.shipping).toBe(10);
    expect(s.platformFees).toBe(1.33);
  });

  it('adds both GST columns without double-counting', () => {
    // gst_aud is added on top (marketplace); gst_included_aud is already inside
    // the shop price. They are different money, so the total is the sum.
    expect(orderGst(shopOrder)).toBe(4.63);
    expect(orderGst(marketplaceOrder)).toBe(1.03);
    expect(summariseRevenue([shopOrder, marketplaceOrder]).gst).toBe(5.66);
  });

  it('subtracts only refunds Stripe actually issued', () => {
    const refunds = [
      { order_id: 'order-mkt', status: 'processed', refund_amount_aud: '10.15' },
      { order_id: 'order-shop', status: 'pending', refund_amount_aud: '50.96' },
      { order_id: 'order-shop', status: 'approved', refund_amount_aud: '50.96' },
    ];
    const s = summariseRevenue([shopOrder, marketplaceOrder], refunds);
    expect(s.gross).toBe(62.29);
    expect(s.refunded).toBe(10.15);
    expect(s.net).toBe(52.14);
  });

  it('ignores refunds for orders outside the set being summarised', () => {
    const s = summariseRevenue([shopOrder], [
      { order_id: 'order-mkt', status: 'processed', refund_amount_aud: '10.15' },
    ]);
    expect(s.refunded).toBe(0);
    expect(s.net).toBe(50.96);
  });

  it('does not accumulate floating point drift over many orders', () => {
    const cents = Array.from({ length: 300 }, (_, i) => ({
      id: `o${i}`, status: 'completed', created_at: '2026-09-01T00:00:00.000Z', total_aud: '0.10',
    }));
    expect(summariseRevenue(cents).gross).toBe(30);
  });

  it('reports a zero-safe average order value on an empty platform', () => {
    const s = summariseRevenue([], []);
    expect(s.averageOrderValue).toBe(0);
    expect(s.net).toBe(0);
    expect(s.orderCount).toBe(0);
  });

  it('averages gross across paid orders', () => {
    expect(summariseRevenue([shopOrder, marketplaceOrder]).averageOrderValue).toBe(31.15);
  });
});

describe('order classification', () => {
  it('labels an all-shop cart as shop and an all-listing cart as marketplace', () => {
    expect(orderChannel(shopOrder)).toBe('shop');
    expect(orderChannel(marketplaceOrder)).toBe('marketplace');
  });

  it('labels a cart spanning both as mixed', () => {
    expect(orderChannel({
      order_items: [{ type: 'shop' }, { type: 'listing' }],
    })).toBe('mixed');
  });

  it('counts line quantities, defaulting a bare order to one item', () => {
    expect(orderItemCount(shopOrder)).toBe(3);
    expect(orderItemCount({ order_items: [] })).toBe(1);
    expect(orderItemCount({})).toBe(1);
  });
});

describe('bucketRevenue', () => {
  it('groups paid orders by month, oldest first, skipping empty periods', () => {
    const series = bucketRevenue([shopOrder, marketplaceOrder, ...unpaidOrders], 'month');
    expect(series).toHaveLength(2);
    expect(series[0].revenue).toBe(11.33);
    expect(series[1].revenue).toBe(50.96);
    expect(series[1].orders).toBe(1);
  });

  it('groups by day when asked', () => {
    const sameDay = { ...marketplaceOrder, id: 'x', created_at: '2026-08-02T22:00:00.000Z' };
    const series = bucketRevenue([marketplaceOrder, sameDay], 'day');
    expect(series).toHaveLength(1);
    expect(series[0].orders).toBe(2);
  });
});

describe('breakdowns', () => {
  it('splits revenue by channel, largest first', () => {
    const byChannel = revenueByChannel([shopOrder, marketplaceOrder]);
    expect(byChannel.map((c) => c.channel)).toEqual(['shop', 'marketplace']);
    expect(byChannel[0].revenue).toBe(50.96);
  });

  it('splits revenue by status', () => {
    const byStatus = revenueByStatus([shopOrder, marketplaceOrder, ...unpaidOrders]);
    expect(byStatus.map((s) => s.status)).toEqual(['payment_confirmed', 'completed']);
  });
});

describe('date ranges', () => {
  it('starts the Australian financial year on 1 July', () => {
    expect(startOfAustralianFinancialYear(new Date(2026, 8, 13))).toEqual(new Date(2026, 6, 1));
    expect(startOfAustralianFinancialYear(new Date(2026, 2, 13))).toEqual(new Date(2025, 6, 1));
  });

  it('filters orders to the selected window and keeps everything for all-time', () => {
    const now = new Date('2026-09-13T00:00:00.000Z');
    const all = [shopOrder, marketplaceOrder];
    expect(filterOrdersByRange(all, 'all', now)).toHaveLength(2);
    expect(filterOrdersByRange(all, '30d', now).map((o) => o.id)).toEqual(['order-shop']);
    expect(filterOrdersByRange(all, '12m', now)).toHaveLength(2);
  });
});

describe('formatAud', () => {
  it('formats to two decimals in AUD', () => {
    expect(formatAud(50.96)).toBe('$50.96');
    expect(formatAud(0)).toBe('$0.00');
    expect(formatAud(null)).toBe('$0.00');
    expect(formatAud('1234.5')).toBe('$1,234.50');
  });
});
