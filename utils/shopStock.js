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
  const qty = product.stock_quantity ?? product.stockQuantity;
  if (qty === null || qty === undefined || qty === '') return false;
  const n = Number(qty);
  return Number.isFinite(n) && n <= 0;
}

export default isSoldOut;
