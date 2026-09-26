/**
 * Shop sale pricing — shared by the storefront AND the server cart
 * (src/services/cartService.js), so what a shopper sees is what Stripe charges.
 *
 * A shop product (or colour variant) carries up to three prices:
 *
 *   price_aud         the regular selling price (normally the RRP)
 *   sale_price_aud    optional sale price; only counts when it is above zero
 *                     and BELOW the regular price
 *   retail_price_aud  the manufacturer's RRP (product level only)
 *
 * A variant with its own price_aud uses its own sale_price_aud; a variant that
 * inherits the product price also inherits the product's sale price, so a
 * product-wide sale covers every colour without editing each one.
 *
 * The struck-through "was" price is the higher of the RRP and the regular
 * price, shown only when it is above what the shopper actually pays — a
 * reference price must be a genuine one (Australian Consumer Law).
 */

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Price breakdown for a shop product, optionally for one of its variants.
 *
 * Returns { price, regular, sale, was, wasIsRrp, onSale, percentOff }:
 *   price       what the shopper pays (AUD)
 *   regular     the non-sale price
 *   sale        the active sale price, or null
 *   was         struck-through reference price, or null
 *   wasIsRrp    true when `was` is the manufacturer's RRP (label it "RRP")
 *   onSale      true when a genuine sale price applies
 *   percentOff  whole-number saving against `was`, or null
 */
export const shopPriceInfo = (product, variant = null) => {
  const variantRegular = num(variant?.price_aud);
  const ownsPrice = variant != null && variantRegular != null;
  const regular = ownsPrice ? variantRegular : (num(product?.price_aud ?? product?.price) ?? 0);
  const saleRaw = ownsPrice ? num(variant?.sale_price_aud) : num(variant?.sale_price_aud ?? product?.sale_price_aud);
  const sale = saleRaw != null && saleRaw > 0 && saleRaw < regular ? saleRaw : null;
  const price = sale ?? regular;

  const rrp = num(product?.retail_price_aud);
  const reference = Math.max(rrp ?? 0, regular);
  const was = reference > price && price > 0 ? reference : null;
  const percentOff = was ? Math.round((1 - price / was) * 100) : null;

  return {
    price: round2(price),
    regular: round2(regular),
    sale: sale != null ? round2(sale) : null,
    was: was != null ? round2(was) : null,
    wasIsRrp: was != null && rrp != null && rrp === reference,
    onSale: sale != null,
    percentOff: percentOff && percentOff > 0 ? percentOff : null,
  };
};

/** What the shopper pays (AUD) for a product / variant. */
export const shopSellingPrice = (product, variant = null) => shopPriceInfo(product, variant).price;

/**
 * Lowest price across a product's active variants (or the product itself) —
 * for grid cards, where no colour is chosen yet.
 */
export const shopFromPriceInfo = (product) => {
  const variants = (Array.isArray(product?.variants) ? product.variants : [])
    .filter((v) => v && v.status !== 'archived');
  if (variants.length === 0) return shopPriceInfo(product);
  return variants
    .map((v) => shopPriceInfo(product, v))
    .reduce((best, info) => (info.price < best.price ? info : best));
};
