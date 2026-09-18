// Shared revenue arithmetic for the admin portal.
//
// Every admin surface that shows "Total Revenue" (the dashboard stat card, the
// analytics report, the revenue breakdown page) reads orders straight from
// Supabase and sums them itself. They used to disagree: the dashboard counted
// ['payment_confirmed','shipped','completed'] and the analytics report counted
// those plus 'refunded' — so the same platform showed two different lifetime
// revenue figures, and neither counted 'delivered', a real order status that
// money had definitely changed hands for. This module is the single definition.
//
// Pure functions only — no Supabase, no React — so the arithmetic is testable
// on its own and the callers just supply rows.

import { startOfDay, startOfWeek, startOfMonth, subDays, subMonths, format } from 'date-fns';

// Statuses where the buyer's card was actually charged. 'refunded' is included
// because the money DID arrive — it's backed out separately as a refund, so
// gross stays truthful and net shows what CardPop kept. 'pending',
// 'payment_failed' and 'cancelled' never took a payment.
export const PAID_ORDER_STATUSES = Object.freeze([
  'payment_confirmed',
  'shipped',
  'delivered',
  'completed',
  'disputed',
  'refunded',
]);

// Refund rows only represent money leaving once Stripe has actually issued it.
// 'pending'/'approved'/'rejected' requests haven't moved any funds.
export const SETTLED_REFUND_STATUSES = Object.freeze(['processed']);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Currency values are summed in cents to avoid float drift accumulating over
// hundreds of orders (0.1 + 0.2 style error shows up fast in a lifetime total).
const toCents = (v) => Math.round(num(v) * 100);
const fromCents = (c) => c / 100;

export const isPaidOrder = (order) => PAID_ORDER_STATUSES.includes(order?.status);

export const isSettledRefund = (refund) => SETTLED_REFUND_STATUSES.includes(refund?.status);

export const formatAud = (value, { decimals = 2 } = {}) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num(value));

// Both GST columns are real GST collected on the order, they just sit in
// different places: gst_aud is added on top (marketplace listings) and
// gst_included_aud is already inside the advertised price (CardPop Shop items
// and shipping). Summing both is the total GST on the order; they never
// overlap, so this does not double-count.
export const orderGst = (order) => fromCents(toCents(order?.gst_aud) + toCents(order?.gst_included_aud));

export const orderItemCount = (order) => {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  if (!items.length) return 1; // single-listing orders carry no order_items array
  return items.reduce((sum, line) => sum + (num(line?.quantity) || 1), 0);
};

// Where the order came from, for the channel split. Cart orders can mix shop
// stock and member listings, so a cart whose lines are all 'shop' is reported
// as Shop rather than a vague "Cart".
export const orderChannel = (order) => {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  if (items.length) {
    const types = new Set(items.map((l) => l?.type || 'listing'));
    if (types.size === 1) return types.has('shop') ? 'shop' : 'marketplace';
    return 'mixed';
  }
  return order?.transaction_type === 'shop' ? 'shop' : 'marketplace';
};

export const CHANNEL_LABELS = Object.freeze({
  shop: 'CardPop Shop',
  marketplace: 'Marketplace',
  mixed: 'Mixed cart',
});

/**
 * Headline figures for a set of orders.
 *
 * @param {Array} orders  order rows (any status — unpaid ones are ignored)
 * @param {Array} refunds refund rows; only settled ones are subtracted
 */
export const summariseRevenue = (orders = [], refunds = []) => {
  const paid = (orders || []).filter(isPaidOrder);

  const totals = paid.reduce(
    (acc, o) => {
      acc.gross += toCents(o.total_aud);
      acc.items += toCents(o.item_price_aud);
      acc.shipping += toCents(o.shipping_aud);
      acc.platformFees += toCents(o.platform_fee_aud);
      acc.gst += toCents(orderGst(o));
      acc.discounts += toCents(o.discount_aud);
      acc.sellerProceeds += toCents(o.seller_proceeds_aud);
      return acc;
    },
    { gross: 0, items: 0, shipping: 0, platformFees: 0, gst: 0, discounts: 0, sellerProceeds: 0 },
  );

  // Only refunds against orders in this set, so a filtered date range doesn't
  // subtract a refund for an order it never counted.
  const paidIds = new Set(paid.map((o) => o.id));
  const refundedCents = (refunds || [])
    .filter((r) => isSettledRefund(r) && paidIds.has(r.order_id))
    .reduce((sum, r) => sum + toCents(r.refund_amount_aud), 0);

  const orderCount = paid.length;

  return {
    orderCount,
    gross: fromCents(totals.gross),
    refunded: fromCents(refundedCents),
    net: fromCents(totals.gross - refundedCents),
    itemSubtotal: fromCents(totals.items),
    shipping: fromCents(totals.shipping),
    platformFees: fromCents(totals.platformFees),
    gst: fromCents(totals.gst),
    discounts: fromCents(totals.discounts),
    sellerProceeds: fromCents(totals.sellerProceeds),
    averageOrderValue: orderCount ? fromCents(Math.round(totals.gross / orderCount)) : 0,
  };
};

// ─── Date ranges ──────────────────────────────────────────────────────────────

// The Australian financial year runs 1 July → 30 June. getMonth() is 0-indexed,
// so month 6 is July.
export const startOfAustralianFinancialYear = (now = new Date()) => {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 6, 1);
};

export const RANGE_OPTIONS = Object.freeze([
  { value: '30d', label: 'Last 30 days', granularity: 'day' },
  { value: '90d', label: 'Last 90 days', granularity: 'week' },
  { value: '12m', label: 'Last 12 months', granularity: 'month' },
  { value: 'fy', label: 'This financial year', granularity: 'month' },
  { value: 'all', label: 'All time', granularity: 'month' },
]);

export const rangeStart = (range, now = new Date()) => {
  switch (range) {
    case '30d': return startOfDay(subDays(now, 29));
    case '90d': return startOfDay(subDays(now, 89));
    case '12m': return startOfMonth(subMonths(now, 11));
    case 'fy': return startOfAustralianFinancialYear(now);
    case 'all':
    default: return null; // no lower bound
  }
};

export const rangeGranularity = (range) =>
  RANGE_OPTIONS.find((r) => r.value === range)?.granularity || 'month';

export const filterOrdersByRange = (orders = [], range, now = new Date()) => {
  const from = rangeStart(range, now);
  if (!from) return orders || [];
  return (orders || []).filter((o) => new Date(o.created_at) >= from);
};

// ─── Time series ──────────────────────────────────────────────────────────────

const bucketStart = (date, granularity) => {
  if (granularity === 'day') return startOfDay(date);
  if (granularity === 'week') return startOfWeek(date, { weekStartsOn: 1 });
  return startOfMonth(date);
};

const bucketLabel = (date, granularity) => {
  if (granularity === 'day') return format(date, 'd MMM');
  if (granularity === 'week') return format(date, 'd MMM');
  return format(date, 'MMM yy');
};

/**
 * Revenue per time bucket, oldest first. Only buckets that actually contain an
 * order are emitted — an admin with five lifetime orders wants five bars, not
 * twelve months of flat zero.
 */
export const bucketRevenue = (orders = [], granularity = 'month') => {
  const buckets = new Map();

  (orders || []).filter(isPaidOrder).forEach((o) => {
    const start = bucketStart(new Date(o.created_at), granularity);
    const key = start.toISOString();
    if (!buckets.has(key)) {
      buckets.set(key, { key, date: start, label: bucketLabel(start, granularity), revenueCents: 0, orders: 0 });
    }
    const b = buckets.get(key);
    b.revenueCents += toCents(o.total_aud);
    b.orders += 1;
  });

  return [...buckets.values()]
    .sort((a, b) => a.date - b.date)
    .map(({ revenueCents, ...rest }) => ({ ...rest, revenue: fromCents(revenueCents) }));
};

/** Gross revenue and order count grouped by sales channel, largest first. */
export const revenueByChannel = (orders = []) => {
  const groups = new Map();

  (orders || []).filter(isPaidOrder).forEach((o) => {
    const channel = orderChannel(o);
    if (!groups.has(channel)) {
      groups.set(channel, { channel, label: CHANNEL_LABELS[channel] || channel, revenueCents: 0, orders: 0 });
    }
    const g = groups.get(channel);
    g.revenueCents += toCents(o.total_aud);
    g.orders += 1;
  });

  return [...groups.values()]
    .map(({ revenueCents, ...rest }) => ({ ...rest, revenue: fromCents(revenueCents) }))
    .sort((a, b) => b.revenue - a.revenue);
};

/** Gross revenue and order count grouped by order status, largest first. */
export const revenueByStatus = (orders = []) => {
  const groups = new Map();

  (orders || []).filter(isPaidOrder).forEach((o) => {
    if (!groups.has(o.status)) groups.set(o.status, { status: o.status, revenueCents: 0, orders: 0 });
    const g = groups.get(o.status);
    g.revenueCents += toCents(o.total_aud);
    g.orders += 1;
  });

  return [...groups.values()]
    .map(({ revenueCents, ...rest }) => ({ ...rest, revenue: fromCents(revenueCents) }))
    .sort((a, b) => b.revenue - a.revenue);
};
