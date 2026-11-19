// Meta (Facebook / Instagram) catalog feed: the same products as the Google
// Merchant Center feed (utils/merchantFeed.js) in the shape Meta's Commerce
// Manager reads, so shop products and Official CardPop Store cards can be
// tagged in Instagram posts and stories. Served at /meta-catalog.tsv by
// api/merchant-feed.js (?format=meta). Runbook: docs/meta-catalog.md.
//
// Differences from the Google feed, and why:
// - `availability` uses Meta's spelling, and Meta accepts only "in stock" /
//   "out of stock". A pre-order is orderable now (paid in full), so it is
//   "in stock" with the estimate stated at the start of its description; the
//   product page labels it Pre-order too. Unlike Google, Meta needs no ISO date,
//   so a pre-order whose estimate names no month is still listed.
// - `link` carries UTM tags so GA4 attributes the visit to the Meta catalog.
// - Google-only columns (`identifier_exists`, `availability_date`) are dropped.
import { shopFeedRow, cardFeedRow, FEED_COLUMNS } from './merchantFeed.js';

const GOOGLE_ONLY_COLUMNS = new Set(['identifier_exists', 'availability_date']);

/** Column order of the Meta feed. */
export const META_FEED_COLUMNS = FEED_COLUMNS.filter((c) => !GOOGLE_ONLY_COLUMNS.has(c));

export const META_UTM = Object.freeze({
  utm_source: 'meta',
  utm_medium: 'social',
  utm_campaign: 'catalog',
});

const DESCRIPTION_MAX = 5000;

/** Adds the catalog UTM tags to a product URL, keeping any existing query. */
export function withMetaUtm(link) {
  try {
    const url = new URL(link);
    for (const [k, v] of Object.entries(META_UTM)) url.searchParams.set(k, v);
    return url.toString();
  } catch {
    return link;
  }
}

function toMeta(row, { preorderEta = '' } = {}) {
  if (!row) return null;
  const preorder = row.availability === 'preorder';
  const eta = String(preorderEta || '').replace(/\s+/g, ' ').trim();
  const out = {};
  for (const col of META_FEED_COLUMNS) out[col] = row[col];
  out.availability = row.availability === 'out_of_stock' ? 'out of stock' : 'in stock';
  out.link = withMetaUtm(row.link);
  if (preorder) {
    const lead = `Pre-order${eta ? ` (estimated ${eta})` : ''}.`;
    const text = `${lead} ${row.description}`;
    out.description = text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : text;
  }
  return out;
}

/** Meta feed row for a `shop_products` row, or null when it can't be sold correctly. */
export function metaShopFeedRow(product) {
  if (product?.status === 'preorder') {
    // Build it as a sellable row first (the Google builder needs a dated ETA
    // to list a pre-order; Meta doesn't), then mark it as the pre-order it is.
    const base = shopFeedRow({ ...product, status: 'active', stock_quantity: null });
    return toMeta(base && { ...base, availability: 'preorder' }, { preorderEta: product.preorder_eta });
  }
  return toMeta(shopFeedRow(product));
}

/** Meta feed row for an Official CardPop Store listing (see cardFeedRow). */
export function metaCardFeedRow(listing, opts) {
  return toMeta(cardFeedRow(listing, opts));
}
