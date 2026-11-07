// Page <title> length for search results.
//
// Google shows roughly 60 characters of a title before cutting it off, so a
// product name followed by " | CardPop Australia" was losing the end of the
// name — the colour, the size, the finish — which is exactly what tells one
// sibling product from another. brandedTitle() keeps the whole name and adds
// the longest brand suffix that still fits, dropping the brand before it would
// ever shorten the name.
//
// Dependency-free: the SPA (SEOHead) and api/prerender.js both build titles
// with it, so a crawler and a browser see the same title.

export const SEO_TITLE_MAX = 60;

export const BRAND_SUFFIXES = [' | CardPop Australia', ' | CardPop'];
// For pages whose title has always ended in the short brand.
export const SHORT_BRAND_SUFFIXES = [' | CardPop'];

export function brandedTitle(name, { max = SEO_TITLE_MAX, suffixes = BRAND_SUFFIXES } = {}) {
  const base = String(name || '').trim() || 'CardPop';
  for (const suffix of suffixes) {
    if (base.length + suffix.length <= max) return `${base}${suffix}`;
  }
  return base;
}
