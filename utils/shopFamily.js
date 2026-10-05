/**
 * Colour families: one shop product per colour, linked by `family_sku`.
 *
 * Multi-colour lines (Palms Off Gaming binders, deck sleeves, cases…) are
 * stored as a separate shop_products row per colour SKU, so each colour gets
 * its own grid card, price, stock and photos. Siblings share `family_sku` (the
 * line SKU, e.g. 'ZB-04'); product pages load the family and show the colours
 * as a picker that switches between the sibling products.
 *
 * This replaces shop_product_variants for these lines — see
 * docs/shop-variants.md for when to use which.
 */
import { shopProductPath } from '@/utils/shopProductUrl.js';
import { colourRank } from '@/utils/colourSwatch.js';
import { isPreorder, isPurchasableStatus } from '@/utils/shopStock.js';

export { colourListText, sortColourNames } from '@/utils/colourSwatch.js';

/** Columns a colour picker needs from each sibling. */
export const FAMILY_SELECT_BASE =
  'id, sku, barcode, title, slug, category, colour, colour_hex, stock_quantity, price_aud, retail_price_aud, status, images, image_url, family_sku';

/** With the pre-order estimate (shop_products.preorder_eta). */
export const FAMILY_SELECT = `${FAMILY_SELECT_BASE}, preorder_eta`;

/** Siblings in swatch order (stable, colour-less rows last). */
export function sortFamily(siblings) {
  return [...(siblings || [])].sort((a, b) =>
    colourRank(a.colour) - colourRank(b.colour)
    || String(a.colour || '').localeCompare(String(b.colour || ''))
    || String(a.sku || '').localeCompare(String(b.sku || '')));
}

/**
 * True when a sibling can be bought right now: a pre-order (unlimited — stock
 * is ignored), or a purchasable sibling with stock. A row without a status is
 * judged on stock alone.
 */
export function siblingAvailable(sibling) {
  if (!sibling) return false;
  if (isPreorder(sibling)) return true;
  if (sibling.status && !isPurchasableStatus(sibling.status)) return false;
  return (Number(sibling.stock_quantity) || 0) > 0;
}

/**
 * Siblings shaped like shop_product_variants rows, so the existing
 * VariantPicker can draw them. Each option's `id` is the sibling PRODUCT id.
 * Pre-order siblings carry `preorder: true` so the picker treats them as
 * available whatever their stock says.
 */
export function familyAsVariants(siblings) {
  return sortFamily(siblings).map((s, i) => ({
    id: s.id,
    sku: s.sku,
    colour: s.colour || null,
    colour_hex: s.colour_hex || null,
    stock_quantity: s.stock_quantity ?? 0,
    // Public siblings only reach the picker; 'archived' would hide the chip.
    status: 'active',
    ...(isPreorder(s) ? { preorder: true } : {}),
    sort_order: i,
  }));
}

/**
 * Default sibling to show: the first available (in stock, or a pre-order),
 * else the first in swatch order.
 */
export function pickDefaultSibling(siblings) {
  const sorted = sortFamily(siblings);
  return sorted.find(siblingAvailable) || sorted[0] || null;
}

/** True when any sibling can be bought — gates the picker's availability marks. */
export function familyHasPurchasable(siblings) {
  return (siblings || []).some((s) => !s?.status || isPurchasableStatus(s.status));
}

/** Page for a sibling — its line's canonical page with the colour preselected. */
export function familyProductPath(sibling) {
  return shopProductPath(sibling);
}

// The supplier's primary retail-packaging render ("…_pkg1.png", or "…_pkg.png"
// where a line has only one). It carries the Palms Off Gaming branding, so it
// leads the gallery rather than the plain cover shot.
const PRIMARY_PACKAGING = /_pkg1?\.(png|jpe?g|webp)(\?|$)/i;

/** Move the primary packaging shot to the front; everything else keeps its order. */
export function packagingFirst(images) {
  const list = Array.isArray(images) ? images : [];
  const i = list.findIndex((url) => PRIMARY_PACKAGING.test(String(url)));
  return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
}

/** Product images for a row: the `images` array (packaging first), else `image_url`. */
export function productImages(row) {
  if (Array.isArray(row?.images) && row.images.length) return packagingFirst(row.images);
  return row?.image_url ? [row.image_url] : [];
}

/**
 * Load a family's publicly visible siblings. Never throws: any error (e.g. the
 * family_sku column not migrated yet) resolves to [] so pages fall back to
 * their single-product behaviour.
 */
export async function fetchFamily(supabase, familySku, statuses) {
  if (!familySku) return [];
  try {
    const run = (columns) => {
      let query = supabase.from('shop_products').select(columns).eq('family_sku', familySku);
      if (statuses?.length) query = query.in('status', statuses);
      return query;
    };
    let { data, error } = await run(FAMILY_SELECT);
    // The site can deploy before the preorder_eta migration lands — retry
    // without it rather than losing the colour picker for the window.
    if (error && /preorder_eta/.test(error.message || '')) ({ data, error } = await run(FAMILY_SELECT_BASE));
    if (error) return [];
    return sortFamily(data || []);
  } catch {
    return [];
  }
}
