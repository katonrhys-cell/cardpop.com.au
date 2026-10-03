import logger from './logger.js';

// GTIN-8 / UPC-A / EAN-13 / GTIN-14, digits only.
const GTIN_RE = /^([0-9]{8}|[0-9]{12,14})$/;

/**
 * The GTINs (barcodes) of the shop products on a Checkout Session's order, for
 * Google Customer Reviews' optional `products` field — it lets Google collect
 * product reviews as well as the seller review. A colour variant's own barcode
 * wins over the product's. Marketplace cards have none and are skipped, as is
 * anything without a valid GTIN.
 *
 * Never throws: the survey opt-in is optional, so any failure is an empty list.
 *
 * @returns {Promise<string[]>} unique GTINs
 */
export async function gtinsForSession(supabase, sessionId) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('order_items')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    const lines = Array.isArray(order?.order_items) ? order.order_items : [];
    const shopLines = lines.filter((l) => l?.type === 'shop' && l.id);
    const gtins = new Set();
    const needProduct = [];
    for (const line of shopLines) {
      const own = String(line.variant_barcode || '').trim();
      if (GTIN_RE.test(own)) gtins.add(own); else needProduct.push(line.id);
    }

    if (needProduct.length > 0) {
      const { data: products } = await supabase
        .from('shop_products')
        .select('id, barcode')
        .in('id', [...new Set(needProduct)]);
      for (const p of products || []) {
        const g = String(p?.barcode || '').trim();
        if (GTIN_RE.test(g)) gtins.add(g);
      }
    }
    return [...gtins];
  } catch (err) {
    logger.warn(`[STRIPE] GTIN lookup for survey opt-in failed: ${err.message}`);
    return [];
  }
}
