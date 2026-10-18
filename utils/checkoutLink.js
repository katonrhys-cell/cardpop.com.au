// Google Merchant Center "checkout link" support.
//
// Merchant Center → Checkout lets a Shopping ad / free listing send the shopper
// straight to the store's cart with the product already in it. Google requires
// the URL template to carry an `{id}` placeholder (the product's offer id in
// Merchant Center) and optionally `{quantity}`; it fills them in per click, e.g.
//
//   https://cardpop.com.au/checkout?id={id}&quantity={quantity}
//     → https://cardpop.com.au/checkout?id=CP-9-POCKET-ZIP-BINDER&quantity=1
//
// `pages/CheckoutPage.jsx` reads those params, looks the product up and adds it
// to the cart (then strips the params so a refresh can't add it twice). The
// offer id Google substitutes is whatever identifies the product in Merchant
// Center — the `sku` our Product markup emits for shop products, or the
// product / listing UUID — so the lookup accepts either. This module is the
// dependency-free part: parsing and the cart-line shapes. See
// docs/merchant-center-checkout.md.

/** The template to paste into Merchant Center → Checkout → "Cart or checkout page URL". */
export const MERCHANT_CHECKOUT_LINK_TEMPLATE = 'https://cardpop.com.au/checkout?id={id}&quantity={quantity}';

export const CHECKOUT_LINK_ID_PARAM = 'id';
export const CHECKOUT_LINK_QUANTITY_PARAM = 'quantity';

/** Most units one checkout link may add — a sanity cap, not a stock rule. */
export const CHECKOUT_LINK_MAX_QUANTITY = 20;
const MAX_ID_LENGTH = 128;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => UUID_RE.test(String(value || '').trim());

/**
 * `?id=…&quantity=…` → `{ id, quantity, isUuid }`, or null when there is no
 * usable id. The id is trimmed and length-capped; the quantity is a whole
 * number clamped to 1..CHECKOUT_LINK_MAX_QUANTITY (anything unparsable is 1).
 *
 * @param {URLSearchParams|{ get: (k: string) => string|null }} searchParams
 */
export function parseCheckoutLinkParams(searchParams) {
  const raw = searchParams?.get?.(CHECKOUT_LINK_ID_PARAM);
  const id = String(raw ?? '').trim();
  if (!id || id.length > MAX_ID_LENGTH) return null;
  // Google substitutes nothing for an id-less click; a literal, un-substituted
  // placeholder means the template was pasted somewhere it isn't expanded.
  if (/^\{.*\}$/.test(id)) return null;
  const q = parseInt(searchParams?.get?.(CHECKOUT_LINK_QUANTITY_PARAM) ?? '', 10);
  const quantity = Number.isFinite(q) ? Math.min(CHECKOUT_LINK_MAX_QUANTITY, Math.max(1, q)) : 1;
  return { id, quantity, isUuid: isUuid(id) };
}

/** SKUs are stored upper-cased and compared case-insensitively. */
export const normaliseSku = (value) => String(value || '').trim().toUpperCase();

/**
 * Cart line for a `shop_products` row (+ an optional chosen colour variant),
 * in the exact shape the product pages hand to `useCart().addToCart` —
 * `{ product, variant, quantity, availableQuantity }`.
 *
 * `resolveImage` turns the row's first image (storage path or URL) into a
 * display URL; `preorderFields` / `isUnlimited` / `toCartVariant` are the
 * shop helpers (utils/shopStock.js, utils/shopVariants.js) passed in so this
 * file stays dependency-free.
 */
export function shopRowToCartLine(row, {
  variant = null,
  quantity = 1,
  resolveImage = (x) => x,
  preorderFields = () => ({}),
  isUnlimited = () => false,
  toCartVariant,
} = {}) {
  if (!row?.id) return null;
  const basePrice = Number(row.price_aud) || 0;
  const unitPrice = variant && variant.price_aud != null && Number.isFinite(Number(variant.price_aud))
    ? Number(variant.price_aud)
    : basePrice;
  const firstImage = Array.isArray(row.images) && row.images.length > 0 ? row.images[0] : row.image_url;
  const cartVariant = variant && toCartVariant
    ? toCartVariant({ id: row.id, price_aud: unitPrice, stock_quantity: row.stock_quantity }, variant)
    : {
        id: row.id,
        price_in_cents: Math.round(unitPrice * 100),
        manage_inventory: row.stock_quantity != null,
        inventory_quantity: row.stock_quantity,
      };
  // Unlimited pre-orders: the cart must not cap them by stock.
  if (isUnlimited(row)) cartVariant.manage_inventory = false;
  const title = variant?.colour ? `${row.title} — ${variant.colour}` : row.title;
  return {
    product: {
      id: row.id,
      source: 'shop',
      type: 'shop',
      title,
      price: unitPrice,
      image: firstImage ? resolveImage(firstImage) : null,
      ...preorderFields(row),
    },
    variant: cartVariant,
    quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
    availableQuantity: cartVariant.inventory_quantity ?? 999,
  };
}

/**
 * Cart line for an active buy-now `listings` row with its `vault_item` embed.
 * Returns null for anything a checkout link can't buy outright (auction,
 * trade-only, expression of interest, not active).
 */
export function listingRowToCartLine(listing, { resolveImage = (x) => x } = {}) {
  if (!listing?.id || listing.status !== 'active') return null;
  if ((listing.listing_type ?? 'fixed') !== 'fixed') return null;
  const card = listing.vault_item || {};
  const images = Array.isArray(card.card_images) && card.card_images.length > 0
    ? card.card_images
    : (card.card_image ? [card.card_image] : []);
  const first = images[0];
  const path = typeof first === 'string' ? first : (first?.url || first?.image_url || first?.path || null);
  return {
    product: {
      id: listing.id,
      source: 'marketplace',
      type: 'listing',
      ...(listing.seller?.is_admin ? { officialStore: true } : {}),
      title: card.card_name || 'Trading card',
      price: Number(listing.price_aud) || 0,
      image: path ? resolveImage(path) : null,
      set: card.set_name || null,
      grading_company: card.grading_company || null,
      grade: card.grade || null,
    },
    variant: null,
    quantity: 1,
    availableQuantity: 1,
  };
}
