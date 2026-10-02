// The refund arithmetic — one place, so the figure the buyer is quoted when
// they request a refund, the one the admin approves, and the one actually sent
// to Stripe can't drift apart. (They had: the request/approval paths hardcoded
// a 50% commission retention and ignored the processing fee, while processing
// used the refund_fee_retention_pct setting AND kept the processing fee, so the
// buyer was told one amount and received a smaller one.)
//
// Dependency-free so the backend refund paths (src/services/refundAmounts.js)
// and the buyer's Account → Orders page compute the same figure.
//
// Marketplace orders — retained from the buyer's refund:
//   - refund_fee_retention_pct of the platform fee (commission incl. its GST)
//   - the payment-processing fee in full — Stripe keeps its fee on a refunded
//     payment, so refunding the buyer's reimbursement of it would make every
//     refund a loss on top of the goods coming back. Orders placed before the
//     fee existed carry 0 and are unaffected.
//
// CardPop Shop orders (every order line is `type: 'shop'`) are refunded in
// full: the shop return policy registered in Google Merchant Center promises
// no restocking fee (utils/shopReturnPolicy.js), and keeping a cut of the
// payment would be one. Shop lines carry no commission, so the only thing a
// shop order could lose is the processing fee — and CardPop absorbs that.
//
// A mixed cart (shop + marketplace lines) keeps the commission share (it is
// all marketplace commission) but only the marketplace portion of the
// processing fee, so the shop goods in it are still refunded in full.

export const DEFAULT_REFUND_FEE_RETENTION_PCT = 50;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const orderLines = (order) => (Array.isArray(order?.order_items) ? order.order_items : []);

/**
 * True when every line of the order is a CardPop Shop product. The cart
 * checkout (src/services/cartService.js) snapshots each line into
 * orders.order_items with `type: 'shop' | 'listing'`; single-item marketplace
 * purchases have no order_items and are never shop orders.
 */
export function isShopOrder(order) {
  const lines = orderLines(order);
  return lines.length > 0 && lines.every((l) => l?.type === 'shop');
}

/**
 * Share (0–1) of the order's pre-processing-fee total that is marketplace
 * money: listing lines, their seller postage and the commission. 1 for an
 * order with no line detail (single-item marketplace purchases), 0 for a
 * shop-only order.
 */
export function marketplaceShare(order) {
  const lines = orderLines(order);
  if (lines.length === 0) return 1;
  if (isShopOrder(order)) return 0;
  if (!lines.some((l) => l?.type === 'shop')) return 1;
  const base = round2(order?.total_aud) - Math.max(0, round2(order?.processing_fee_aud));
  if (!(base > 0)) return 1;
  const marketplace = lines
    .filter((l) => l?.type !== 'shop')
    .reduce((sum, l) => sum + (Number(l?.line_total_aud) || 0) + (Number(l?.shipping_aud) || 0), 0)
    + (Number(order?.platform_fee_aud) || 0);
  return Math.min(1, Math.max(0, marketplace / base));
}

/**
 * Compute the refund split from the server-authoritative ORDER row (never
 * from the buyer-created refunds row, whose fee columns a buyer could zero).
 *
 * @param order { total_aud, platform_fee_aud, processing_fee_aud?, order_items? }
 * @param retentionPct percentage of platform_fee_aud to keep (0-100)
 * @returns {{ orderTotal, shopOrder, retentionPct, retainedCommission, processingFee, retainedFee, refundAmount }}
 *   processingFee is the part of the order's processing fee that is retained.
 */
export function computeRefundAmounts(order, retentionPct = DEFAULT_REFUND_FEE_RETENTION_PCT) {
  const orderTotal = round2(order?.total_aud);
  const pct = Number.isFinite(Number(retentionPct)) ? Number(retentionPct) : DEFAULT_REFUND_FEE_RETENTION_PCT;
  const shopOrder = isShopOrder(order);
  if (shopOrder) {
    return { orderTotal, shopOrder, retentionPct: pct, retainedCommission: 0, processingFee: 0, retainedFee: 0, refundAmount: orderTotal };
  }
  const totalCommission = round2(order?.platform_fee_aud);
  const processingFee = round2(Math.max(0, round2(order?.processing_fee_aud)) * marketplaceShare(order));
  const retainedCommission = round2(totalCommission * (pct / 100));
  const retainedFee = round2(retainedCommission + processingFee);
  const refundAmount = round2(orderTotal - retainedFee);
  return { orderTotal, shopOrder, retentionPct: pct, retainedCommission, processingFee, retainedFee, refundAmount };
}
