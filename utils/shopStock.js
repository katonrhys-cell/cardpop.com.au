/**
 * A shop product is sold out only when it tracks stock AND that stock is 0.
 * Rows with no stock_quantity (marketplace listings, vault items — which
 * ProductCard also renders) are never "sold out" by this definition, so the
 * sold-out UI stays confined to platform shop products.
 *
 * Accepts either the raw shop_products column (`stock_quantity`) or the
 * camelCase copy ProductDetailPage keeps (`stockQuantity`).
 */
export function isSoldOut(product) {
  if (!product) return false;
  // Pre-orders are unlimited — sold ahead of stock, so never "sold out".
  if (isPreorder(product)) return false;
  const qty = product.stock_quantity ?? product.stockQuantity;
  if (qty === null || qty === undefined || qty === '') return false;
  const n = Number(qty);
  return Number.isFinite(n) && n <= 0;
}

export default isSoldOut;

/**
 * Statuses the public storefront shows. `active` and `preorder` can be bought;
 * `coming_soon` is look-but-enquire only.
 */
export const PUBLIC_SHOP_STATUSES = ['active', 'preorder', 'coming_soon'];

/**
 * Statuses checkout accepts. A pre-order is sold and paid for exactly like an
 * active product — only the labelling and the dispatch estimate differ. The
 * backend cart pricer (src/services/cartService.js) imports this list too, so
 * the storefront's "Add to cart" and the server's refusal can't drift apart.
 */
export const PURCHASABLE_SHOP_STATUSES = ['active', 'preorder'];

/** True when a product in this status can be added to the cart and bought. */
export function isPurchasableStatus(status) {
  return PURCHASABLE_SHOP_STATUSES.includes(status);
}

/** Realtime filter matching PUBLIC_SHOP_STATUSES (Supabase `in` syntax). */
export const PUBLIC_SHOP_STATUS_FILTER = `status=in.(${PUBLIC_SHOP_STATUSES.join(',')})`;

/** Marked "coming soon" by admin: visible, not purchasable, enquiry button. */
export function isComingSoon(product) {
  return product?.status === 'coming_soon';
}

/** Fallback shown if a pre-order somehow has no estimate (the DB requires one). */
export const PREORDER_ETA_FALLBACK = 'Ships when stock arrives';

/** Longest dispatch estimate the DB accepts (shop_products_preorder_eta_length). */
export const PREORDER_ETA_MAX_LENGTH = 120;

/**
 * Marked "pre-order" by admin: visible AND purchasable, paid in full now,
 * dispatched when stock arrives. Accepts a shop_products row or the cart /
 * ProductDetailPage copies of it.
 */
export function isPreorder(product) {
  return product?.status === 'preorder' || product?.preorder === true;
}

/**
 * The admin's estimated-dispatch text for a pre-order ("Ships in 4–6 weeks"),
 * trimmed. Reads the DB column or the camelCase / order-line copies. Returns
 * '' for a product that isn't a pre-order.
 */
export function preorderEta(product) {
  if (!isPreorder(product)) return '';
  const raw = product?.preorder_eta ?? product?.preorderEta ?? '';
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text || PREORDER_ETA_FALLBACK;
}

/**
 * True when the cart should not cap this product by stock_quantity. Pre-orders
 * are unlimited; everything else is capped by its stock as before.
 */
export function hasUnlimitedStock(product) {
  return isPreorder(product);
}

/**
 * Fields to spread into a cart product so the cart drawer can label a
 * pre-order. Display only — checkout re-reads status and estimate server-side.
 */
export function preorderCartFields(product) {
  return isPreorder(product) ? { preorder: true, preorderEta: preorderEta(product) } : {};
}

/**
 * Pre-order lines of an order (orders.order_items, jsonb). cartService stamps
 * `preorder: true` + `preorder_eta` on each pre-ordered shop line at checkout.
 */
export function orderPreorderLines(order) {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  return items.filter((l) => l && l.preorder === true);
}

/** A paid order with pre-order lines that hasn't shipped yet. */
export function isAwaitingPreorderStock(order) {
  return order?.status === 'payment_confirmed' && orderPreorderLines(order).length > 0;
}
