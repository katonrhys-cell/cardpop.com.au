/**
 * Colour-variant helpers shared by the storefront, cart and admin.
 *
 * A shop product may carry `variants` (rows of shop_product_variants). When it
 * has at least one ACTIVE variant the shopper must pick one before Add to
 * Cart; stock and (optionally) price come from the variant. A product with no
 * variants behaves as a single unit, exactly as before variants existed.
 */

export const activeVariants = (product) =>
  (Array.isArray(product?.variants) ? product.variants : [])
    .filter((v) => v && v.status !== 'archived')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.colour || '').localeCompare(String(b.colour || '')));

export const hasVariants = (product) => activeVariants(product).length > 0 || product?.has_variants === true;

/** Variant-aware unit price (AUD): the variant override, else the product price. */
export const variantPrice = (product, variant) => {
  const v = variant?.price_aud != null ? Number(variant.price_aud) : null;
  const p = Number(product?.price_aud ?? product?.price ?? 0);
  return Number.isFinite(v) ? v : p;
};

export const variantStock = (variant) => Math.max(0, parseInt(variant?.stock_quantity, 10) || 0);
export const variantInStock = (variant) => variantStock(variant) > 0;

/**
 * Shopper-facing label for a variant: its colour, else "Standard". Never the
 * SKU — SKUs are internal (admin/stock) identifiers, not storefront copy.
 */
export const variantLabel = (variant) => variant?.colour || 'Standard';

/**
 * Default selection: the first in-stock variant, else the first variant, else
 * null. A single-variant product auto-selects so the buy button works
 * without a click.
 */
export const pickDefaultVariant = (product) => {
  const list = activeVariants(product);
  if (list.length === 0) return null;
  return list.find(variantInStock) || list[0];
};

/** Cart "variant" object the useCart hook expects, for a chosen variant. */
export const toCartVariant = (product, variant) => {
  const price = variantPrice(product, variant);
  if (!variant) {
    return {
      id: product.id,
      price_in_cents: Math.round(price * 100),
      manage_inventory: product.stock_quantity != null,
      inventory_quantity: product.stock_quantity,
    };
  }
  return {
    id: variant.id,              // cart line identity — one line per colour
    variant_id: variant.id,      // sent to the server as variantId
    title: variantLabel(variant),
    sku: variant.sku,
    price_in_cents: Math.round(price * 100),
    manage_inventory: true,
    inventory_quantity: variantStock(variant),
  };
};

/** Embedded select fragment for Supabase queries that need variants. */
export const VARIANTS_SELECT = 'variants:shop_product_variants(id, sku, barcode, colour, colour_hex, stock_quantity, price_aud, status, sort_order)';
