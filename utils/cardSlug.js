import { slugify } from '@/lib/slugify.js';

// Build and parse SEO-friendly slugs for the card analytics page.
//
// The analytics page used to live at `/analytics/card?name=…&set=…&price=…`,
// which is poor for SEO: the path is identical for every card (so the
// query-stripped canonical collapsed them all into one URL) and the volatile
// `price`/`change` params spawned infinite duplicate variants.
//
// Instead we carry the card identity in a readable slug path —
// `/analytics/card/lebron-james-rc-auto-2003-04-upper-deck` — which gives each
// card a unique, descriptive canonical. The exact name/set/collection (and the
// demo price/change/image) still ride along as query params so in-app
// navigation renders precise data; the slug is the SEO-facing, canonical part.

// String → URL slug is the shared helper in lib/slugify.js — one source of
// truth (also used by the marketplace/product/vault link builders). Re-exported
// here so existing importers of this module keep working.
export { slugify };

// Identity slug for a card = name + set, slugified. Falls back to "card" so we
// never emit an empty path segment.
export const cardSlug = (name = '', set = '') => {
  const slug = slugify([name, set].filter(Boolean).join(' '));
  return slug || 'card';
};

// Best-effort human-readable title from a bare slug — used only when a crawler
// or a shared link hits the canonical URL with no query params. In-app
// navigation always supplies exact name/set via the query string, so this
// title-cased approximation is a graceful fallback, not the common path.
export const parseCardSlug = (slug = '') => {
  const name = String(slug)
    .replace(/-+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, set: '' };
};

// Build the full analytics URL for a card object. The slug path is the SEO/
// canonical part; query params carry exact + volatile data for the running app.
export const buildCardAnalyticsUrl = (card = {}) => {
  const { name = '', set = '', collection = '', price, change, thumbnailUrl, image, cardsight_id } = card;
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (set) params.set('set', set);
  if (collection) params.set('collection', collection);
  if (price !== undefined && price !== null) params.set('price', String(price));
  if (change !== undefined && change !== null) params.set('change', String(change));
  const img = thumbnailUrl || image;
  if (img) params.set('image', img);
  if (cardsight_id) params.set('cardsight_id', cardsight_id);
  const qs = params.toString();
  return `/analytics/card/${cardSlug(name, set)}${qs ? `?${qs}` : ''}`;
};
