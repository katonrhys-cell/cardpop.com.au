// Google Merchant Center product feed (tab-delimited) for the two things
// CardPop sells itself: shop products and Official CardPop Store cards.
//
// Merchant Center otherwise discovers products by crawling the `Product`
// structured data on every page — which includes community sellers' cards. A
// feed is the only way to say "these and nothing else", so it is registered as
// the account's data source and the website-crawl source is switched off.
// Runbook: docs/merchant-feed.md.
//
// Dependency-free apart from the shared helpers, so api/merchant-feed.js and the
// tests import it directly. Rows use Merchant Center's own attribute names.
import { shopProductPath, slugify } from './shopProductUrl.js';
import { shopProductIdentifiersLd, cardBrandName, cardMpn } from './productIdentifiers.js';

export const FEED_BASE_URL = 'https://cardpop.com.au';

/** Column order of the feed — Merchant Center reads the header row by name. */
export const FEED_COLUMNS = [
  'id', 'title', 'description', 'link', 'image_link', 'additional_image_link',
  'availability', 'availability_date', 'price', 'condition', 'brand', 'gtin', 'mpn', 'identifier_exists',
  'item_group_id', 'color', 'google_product_category', 'product_type',
];

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const EXTRA_IMAGES_MAX = 10;
const CARD_CATEGORY = 'Arts & Entertainment > Hobbies & Creative Arts > Collectibles > Collectible Trading Cards';

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// Plain text only: Merchant Center rejects markup in titles and descriptions.
const plain = (value) => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const money = (n) => `${Number(n).toFixed(2)} AUD`;

const absoluteUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^https?:\/\//.test(u) ? u : `${FEED_BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

/** Pre-orders are sold (paid in full now), so they are in the feed with a date. */
export const FEED_SHOP_STATUSES = ['active', 'preorder'];

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * `availability_date` for a pre-order, from the admin's free-text estimate
 * (`shop_products.preorder_eta`, e.g. "December 2026"). Merchant Center needs
 * an ISO 8601 date, so only an estimate that names a month can be placed: the
 * 1st of that month (AEDT, +11:00), in `now`'s year or the next one if that
 * month has passed. Returns null for "Ships when stock arrives" and the like —
 * the product is then left out rather than listed with a made-up date.
 */
export function preorderAvailabilityDate(eta, now = new Date()) {
  const text = String(eta || '').toLowerCase();
  const month = MONTHS.findIndex((m) => new RegExp(`\\b(?:${m}|${m.slice(0, 3)})\\b`).test(text));
  if (month < 0) return null;
  const yearMatch = text.match(/\b(20\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : now.getUTCFullYear();
  if (!yearMatch && month < now.getUTCMonth()) year += 1;
  return `${year}-${String(month + 1).padStart(2, '0')}-01T00:00+1100`;
}

/** Feed row for a `shop_products` row, or null when it can't be sold correctly. */
export function shopFeedRow(product) {
  const price = Number(product?.price_aud);
  const title = plain(product?.title);
  const sku = String(product?.sku || '').trim();
  const image = absoluteUrl(product?.images?.[0] || product?.image_url);
  if (!sku || !title || !(price > 0) || !image) return null;

  const { brand, mpn, gtin } = shopProductIdentifiersLd(product);
  const preorder = product.status === 'preorder';
  // Pre-orders are unlimited (stock is ignored), but need a date to be listed.
  const availabilityDate = preorder ? preorderAvailabilityDate(product.preorder_eta) : null;
  if (preorder && !availabilityDate) return null;
  const qty = product.stock_quantity;
  const inStock = preorder || qty == null || Number(qty) > 0;
  const extras = (product.images || []).slice(1, 1 + EXTRA_IMAGES_MAX).map(absoluteUrl).filter(Boolean);
  const family = String(product.family_sku || '').trim();

  return {
    id: sku,
    title: clip(title, TITLE_MAX),
    description: clip(plain(product.description) || title, DESCRIPTION_MAX),
    link: `${FEED_BASE_URL}${shopProductPath(product)}`,
    image_link: image,
    additional_image_link: extras.join(','),
    availability: preorder ? 'preorder' : inStock ? 'in_stock' : 'out_of_stock',
    availability_date: availabilityDate || '',
    price: money(price),
    condition: 'new',
    brand: brand.name,
    gtin: gtin || '',
    mpn: mpn || '',
    identifier_exists: gtin || mpn ? 'yes' : 'no',
    item_group_id: family,
    color: family ? plain(product.colour) : '',
    google_product_category: '',
    product_type: plain(product.category),
  };
}

/**
 * Feed row for an active buy-now listing by an admin seller, or null. `listing`
 * is the shape api/merchant-feed.js selects (listing + its vault_item), and
 * `imagePath` the already-resolved public image URL.
 */
export function cardFeedRow(listing, { imageUrls = [] } = {}) {
  const card = listing?.vault_item || {};
  const price = Number(listing?.price_aud);
  const name = plain(card.card_name);
  const [image, ...rest] = imageUrls;
  if (!listing?.id || !name || !(price > 0) || !image) return null;

  const grade = card.grade ? `${plain(card.grading_company || listing.grading_company)} ${plain(card.grade)}`.trim() : '';
  const setLine = [card.set_name, card.year].filter(Boolean).join(' · ');
  const title = [name, grade].filter(Boolean).join(' - ');
  const brand = cardBrandName(card.collection, card.franchise?.name, card.category?.name);
  const mpn = cardMpn({ setName: card.set_name, cardNumber: card.card_number });
  const slug = listing.slug || slugify(name) || 'listing';

  return {
    id: listing.id,
    title: clip(title, TITLE_MAX),
    description: clip(`${title}${setLine ? ` (${setLine})` : ''}${card.condition ? `. Condition: ${plain(card.condition)}` : ''}. Sold by the CardPop Official Store.`, DESCRIPTION_MAX),
    link: `${FEED_BASE_URL}/marketplace/${listing.id}/${slug}`,
    image_link: image,
    additional_image_link: rest.slice(0, EXTRA_IMAGES_MAX).join(','),
    availability: 'in_stock',
    availability_date: '',
    price: money(price),
    // Merchant Center only knows new / refurbished / used; a collectable card
    // that has been graded or played is "used" either way.
    condition: 'used',
    brand: brand || 'CardPop',
    gtin: '',
    mpn: mpn || '',
    // A single card has no GTIN: brand + mpn is the pair Google accepts.
    identifier_exists: brand && mpn ? 'yes' : 'no',
    item_group_id: '',
    color: '',
    google_product_category: CARD_CATEGORY,
    product_type: plain(card.collection || card.category?.name || 'Trading Cards'),
  };
}

// A tab or newline inside a value would shift every column after it.
const cell = (value) => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();

/** Serialise rows (nulls skipped) to Merchant Center's tab-delimited format. */
export function toTsv(rows) {
  const lines = [FEED_COLUMNS.join('\t')];
  const seen = new Set();
  for (const row of rows) {
    if (!row || seen.has(row.id)) continue; // ids must be unique in a feed
    seen.add(row.id);
    lines.push(FEED_COLUMNS.map((col) => cell(row[col])).join('\t'));
  }
  return `${lines.join('\n')}\n`;
}
