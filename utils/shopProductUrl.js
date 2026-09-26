/**
 * Canonical URL for a shop product: /shop/<category-slug>/<line-slug>
 *
 * Every shop product lives inside the shop's product-type taxonomy, the same
 * shape the Palms Off Gaming catalogue pages already use:
 *
 *   /shop/binders/palms-off-gaming-stealth-12-pocket-zip-binder?colour=blue
 *   /shop/top-loaders/palms-off-gaming-booster-pack-top-loaders
 *   /shop/penny-sleeves/penny-sleeves-100-pack
 *
 * - <category-slug> is the slugified `shop_products.category` ("Premium
 *   Sleeves" → premium-sleeves), which is exactly the leaf slug in
 *   utils/shopCategories.js and data/palmsOffCatalogue.js.
 * - <line-slug> is the product's `slug`. A colour sibling (one row per colour,
 *   linked by family_sku — utils/shopFamily.js) shares its line's page: its
 *   slug is the line slug + "-<colour>", so the suffix is dropped and the
 *   colour rides along as ?colour=<colour-slug>, which the page preselects.
 *
 * Anything that can't be placed (no slug or category) falls back to the legacy
 * /product/shop/<id>/<slug> URL, which still works and redirects when it can.
 *
 * Dependency-free on purpose: the SPA, api/prerender.js, api/sitemap.js and the
 * Express backend all import it, so every surface emits the same URL.
 */

// Mirror of lib/slugify.js, inline so server code can import this file alone.
export const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

// First segments already taken by fixed /shop/<x>/<y> routes.
const RESERVED_CATEGORY_SLUGS = new Set(['category']);

/** Category segment for a product, or null if it has no usable category. */
export function shopCategorySlug(row) {
  const slug = slugify(row?.category || '');
  return slug && !RESERVED_CATEGORY_SLUGS.has(slug) ? slug : null;
}

/** Colour query value for a colour sibling, else null. */
export function shopColourParam(row) {
  return row?.family_sku && row?.colour ? slugify(row.colour) || null : null;
}

/** The line's slug: a colour sibling's slug without its "-<colour>" suffix. */
export function shopLineSlug(row) {
  const slug = String(row?.slug || '').trim();
  const colour = shopColourParam(row);
  if (slug && colour && slug.endsWith(`-${colour}`)) return slug.slice(0, -(colour.length + 1));
  return slug || null;
}

/** Legacy id-based path — the fallback, and what old links still point at. */
export function legacyShopProductPath(row) {
  return `/product/shop/${row?.id}/${slugify(row?.title || row?.name || 'product') || 'product'}`;
}

/** Canonical path without the colour query (the page's canonical URL). */
export function shopProductBasePath(row) {
  const category = shopCategorySlug(row);
  const line = shopLineSlug(row);
  return category && line ? `/shop/${category}/${line}` : null;
}

/** Path to link to: the canonical page, preselecting this row's colour. */
export function shopProductPath(row) {
  const base = shopProductBasePath(row);
  if (!base) return legacyShopProductPath(row);
  const colour = shopColourParam(row);
  return colour ? `${base}?colour=${colour}` : base;
}

export default shopProductPath;
