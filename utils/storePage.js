// Card shop pages — the shared, dependency-free rules for one store's own page
// in the directory (/card-shops/<city>/<slug>).
//
// A store is a `local_game_stores` row. Its page shows what the directory
// already held (name, suburb, categories, description, website) plus the parts
// an admin adds in Admin → Store Directory: street address, phone, opening
// hours, Instagram, a photo gallery (`photos`, [{url, caption}]) and videos
// (`videos`, [{url, poster_url, caption}] — an uploaded clip or a
// YouTube/Vimeo link). This module is the one normaliser for those, and builds
// the page's title, description and LocalBusiness JSON-LD, so the SPA page,
// the admin editor, api/prerender.js and api/sitemap.js agree. Keep it free of
// React and Supabase imports: the prerenderer runs it in a bare Node function.
// See docs/store-pages.md.

import { cleanGallery, cleanVideos, safeLink } from './eventReview.js';

export const MAX_STORE_PHOTOS = 24;
export const MAX_STORE_VIDEOS = 6;
export const MAX_STORE_HOURS_LINES = 10;

const SITE_ORIGIN = 'https://cardpop.com.au';

// Everything a store page reads. Never `select('*')`: submitter_email and
// submitted_by sit outside the public column grant, so a star select fails.
export const STORE_PAGE_COLUMNS =
  'id, slug, name, suburb, city, state, address, website, phone, categories, description, status, opening_hours, instagram_url, logo_url, photos, videos, updated_at';

// What a directory list row reads (city page, hub, local map).
export const STORE_LIST_COLUMNS =
  'slug, name, suburb, city, state, website, categories, description, logo_url, photos';

const trimOrNull = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/** `/card-shops/<city>/<slug>` for a store row, or null without both parts. */
export function storePath(store) {
  const city = trimOrNull(store?.city);
  const slug = trimOrNull(store?.slug);
  if (!city || !slug) return null;
  return `/card-shops/${encodeURIComponent(city)}/${encodeURIComponent(slug)}`;
}

/** The store's photos, in display order: [{ url, caption, alt }]. */
export function cleanStorePhotos(photos) {
  const seen = new Set();
  const out = [];
  for (const p of cleanGallery(photos)) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    out.push(p);
    if (out.length >= MAX_STORE_PHOTOS) break;
  }
  return out;
}

/** The store's videos, in display order: [{ url, poster_url, caption }]. */
export function cleanStoreVideos(videos) {
  return cleanVideos(videos).slice(0, MAX_STORE_VIDEOS);
}

/** Opening hours as display lines ("Tuesday: 11am – 7pm"), one per row. */
export function storeHoursLines(openingHours) {
  if (typeof openingHours !== 'string') return [];
  return openingHours
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_STORE_HOURS_LINES);
}

/** The first photo's URL — the tile on the city page and the og:image. */
export function storeCoverPhoto(store) {
  return cleanStorePhotos(store?.photos)[0]?.url || null;
}

/** The shop's logo URL (http(s) or a bundled site-relative file), or null. */
export function storeLogoUrl(store) {
  return safeLink(store?.logo_url);
}

/** An http(s) link for the store's website / Instagram, or null. */
export function storeExternalLink(url) {
  const safe = safeLink(url);
  return safe && /^https?:\/\//i.test(safe) ? safe : null;
}

/** A site-relative media path made absolute (JSON-LD and og:image need it). */
export function absoluteMediaUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  return url.startsWith('/') ? `${SITE_ORIGIN}${url}` : url;
}

/**
 * Whether the page carries enough of its own to be indexed. A store with only
 * the directory line (name, suburb, one sentence) is already fully shown on
 * its city page, so its own page is `noindex, follow` and stays out of the
 * sitemap until it has a photo, a video or opening hours.
 */
export function storeIsIndexable(store) {
  if (!store || store.status !== 'approved') return false;
  return cleanStorePhotos(store.photos).length > 0
    || cleanStoreVideos(store.videos).length > 0
    || storeHoursLines(store.opening_hours).length > 0;
}

/** "Suburb, STATE" (or the street address when there is one). */
export function storeLocationLine(store) {
  const address = trimOrNull(store?.address);
  if (address) return address;
  return [trimOrNull(store?.suburb), trimOrNull(store?.state)].filter(Boolean).join(', ');
}

export function storePageTitle(store, cityLabel) {
  const where = trimOrNull(store?.suburb) || cityLabel || '';
  return `${store?.name || 'Card shop'}${where ? ` — Card Shop in ${where}` : ''} | CardPop`;
}

export function storePageDescription(store, cityLabel) {
  const own = trimOrNull(store?.description);
  const suburb = trimOrNull(store?.suburb);
  const where = [suburb, suburb?.toLowerCase() === String(cityLabel || '').toLowerCase() ? null : cityLabel]
    .filter(Boolean).join(', ') || trimOrNull(store?.state) || 'Australia';
  const lead = `${store?.name || 'This card shop'} in ${where}`;
  const text = own ? `${lead}: ${own}` : `${lead} — address, opening hours, photos and what it stocks.`;
  return text.length > 300 ? `${text.slice(0, 297).trimEnd()}…` : text;
}

/** LocalBusiness (Store) JSON-LD for the page. */
export function storeJsonLd(store) {
  const path = storePath(store);
  const photos = cleanStorePhotos(store?.photos).map((p) => absoluteMediaUrl(p.url)).filter(Boolean);
  const sameAs = [storeExternalLink(store?.website), storeExternalLink(store?.instagram_url)].filter(Boolean);
  const address = trimOrNull(store?.address);
  const suburb = trimOrNull(store?.suburb);
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store?.name,
    ...(path ? { url: `${SITE_ORIGIN}${path}` } : {}),
    ...(trimOrNull(store?.description) ? { description: trimOrNull(store.description) } : {}),
    ...(storeLogoUrl(store) ? { logo: absoluteMediaUrl(storeLogoUrl(store)) } : {}),
    ...(photos.length ? { image: photos.slice(0, 8) } : {}),
    ...(trimOrNull(store?.phone) ? { telephone: trimOrNull(store.phone) } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(address ? { streetAddress: address } : {}),
      ...(suburb ? { addressLocality: suburb } : {}),
      ...(store?.state ? { addressRegion: store.state } : {}),
      addressCountry: 'AU',
    },
  };
}

const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

/** The slug a new store gets: "<name> <suburb or city>", as the public form does. */
export function storeSlug(name, place) {
  return slugify(`${name || ''} ${place || ''}`) || 'store';
}

/**
 * The columns the admin editor may write, normalised. Throws with a message
 * the form can show when a required part is missing or a link is unsafe.
 */
export function normalizeStoreInput(input = {}) {
  const name = trimOrNull(input.name);
  if (!name || name.length < 2) throw new Error('Store name is required.');
  const city = trimOrNull(input.city)?.toLowerCase();
  if (!city) throw new Error('Choose the city or region.');
  const state = trimOrNull(input.state)?.toUpperCase();
  if (!state) throw new Error('Choose the state.');
  const link = (value, label) => {
    const raw = trimOrNull(value);
    if (!raw) return null;
    const safe = storeExternalLink(raw);
    if (!safe) throw new Error(`${label} must be a full link starting with https://`);
    return safe;
  };
  return {
    name: name.slice(0, 120),
    suburb: trimOrNull(input.suburb)?.slice(0, 80) || null,
    city,
    state,
    address: trimOrNull(input.address)?.slice(0, 200) || null,
    phone: trimOrNull(input.phone)?.slice(0, 40) || null,
    website: link(input.website, 'Website'),
    instagram_url: link(input.instagram_url, 'Instagram'),
    logo_url: safeLink(input.logo_url),
    description: trimOrNull(input.description)?.slice(0, 1200) || null,
    opening_hours: storeHoursLines(input.opening_hours).join('\n') || null,
    categories: Array.isArray(input.categories) ? input.categories.filter((c) => typeof c === 'string') : [],
    photos: cleanStorePhotos(input.photos).map(({ url, caption }) => ({ url, caption })),
    videos: cleanStoreVideos(input.videos),
  };
}
