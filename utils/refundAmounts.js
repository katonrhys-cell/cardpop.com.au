// The refund arithmetic — one place, so the figure the buyer is quoted when
// they request a refund, the one the admin approves, and the one actually sent
// to Stripe can't drift apart.
//
// Dependency-free so the backend refund paths (src/services/refundAmounts.js)
// and the buyer's Account → Orders page compute the same figure.
//
// Policy (utils/buyerProtectionPolicy.js, decided 2026-10-03): an approved
// refund is a FULL refund — item, postage, service fee and processing fee —
// whether the card was misdescribed, damaged, counterfeit, never sent or lost
// in transit. Change of mind isn't an eligible reason on a marketplace card,
// so there is no "no-fault" refund left to keep a fee on. The seller's payout
// is reversed (refundService.reverseSellerPayout); Stripe keeps its own
// processing fee on a refunded charge, and CardPop absorbs that.
//
// The retention machinery is kept behind two platform settings so the policy
// can be tightened without a deploy, but both default to "retain nothing":
//   - refund_fee_retention_pct      share of platform_fee_aud kept (default 0)
//   - refund_retain_processing_fee  keep the processing fee too (default false)
//
// CardPop Shop orders (every order line is `type: 'shop'`) are always refunded
// in full — the shop return policy registered in Google Merchant Center
// promises no restocking fee (utils/shopReturnPolicy.js). A mixed cart applies
// any retention to the marketplace share only, so shop goods always come back
// in full.

export const DEFAULT_REFUND_FEE_RETENTION_PCT = 0;
export const DEFAULT_REFUND_RETAIN_PROCESSING_FEE = false;

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
 * @param retentionPct percentage of platform_fee_aud to keep (0-100; default 0)
 * @param options.retainProcessingFee keep the (marketplace share of the) processing fee (default false)
 * @returns {{ orderTotal, shopOrder, retentionPct, retainedCommission, processingFee, retainedFee, refundAmount }}
 *   processingFee is the part of the order's processing fee that is retained.
 */
export function computeRefundAmounts(order, retentionPct = DEFAULT_REFUND_FEE_RETENTION_PCT, { retainProcessingFee = DEFAULT_REFUND_RETAIN_PROCESSING_FEE } = {}) {
  const orderTotal = round2(order?.total_aud);
  const pct = Number.isFinite(Number(retentionPct)) ? Number(retentionPct) : DEFAULT_REFUND_FEE_RETENTION_PCT;
  const shopOrder = isShopOrder(order);
  if (shopOrder) {
    return { orderTotal, shopOrder, retentionPct: pct, retainedCommission: 0, processingFee: 0, retainedFee: 0, refundAmount: orderTotal };
  }
  const totalCommission = round2(order?.platform_fee_aud);
  const processingFee = retainProcessingFee
    ? round2(Math.max(0, round2(order?.processing_fee_aud)) * marketplaceShare(order))
    : 0;
  const retainedCommission = round2(totalCommission * (pct / 100));
  const retainedFee = round2(retainedCommission + processingFee);
  const refundAmount = round2(orderTotal - retainedFee);
  return { orderTotal, shopOrder, retentionPct: pct, retainedCommission, processingFee, retainedFee, refundAmount };
}
