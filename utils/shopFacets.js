/**
 * Type + colour filters for a shop category grid (e.g. /shop/category/binders).
 *
 * Colour lines are one shop_products row per colour linked by `family_sku`
 * (see utils/shopFamily.js), so a category like Binders is ~8 product lines ×
 * ~7 colours. "Type" is the product line: the family (or the product itself
 * when it has no family), labelled with its title minus the brand prefix and
 * the " — <colour>" suffix the colour split appended.
 *
 * Facets are computed client-side from a lightweight list of every product in
 * the category (FACET_SELECT); the grid query then filters server-side by the
 * matching ids / colour, so pagination stays accurate.
 */
import { sortFamily } from '@/utils/shopFamily.js';

/** Columns needed to build the filters. */
export const FACET_SELECT = 'id, sku, title, brand, family_sku, colour, colour_hex';

const norm = (s) => String(s || '').trim().toLowerCase();

/** Key grouping a product into its line: family SKU, else its own SKU/id. */
export const typeKey = (p) => String(p?.family_sku || p?.sku || p?.id || '').toUpperCase();

/** Human label for a product's line. */
export function typeLabel(p) {
  let title = String(p?.title || '').trim();
  // Drop the " — Pink" suffix the per-colour split added.
  if (p?.colour) {
    const suffix = new RegExp(`\\s*[—–-]\\s*${p.colour.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    title = title.replace(suffix, '');
  }
  // Drop the brand prefix ("Palms Off Gaming …") — every card in the row shares it.
  const brand = String(p?.brand || '').trim();
  if (brand && title.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
    title = title.slice(brand.length + 1);
  }
  return title || p?.sku || 'Other';
}

/**
 * Type options: one per product line, with a count. Returns [] when filtering
 * by type would be pointless — fewer than two lines, or no line holds more
 * than one product (every "type" would be a single product).
 */
export function buildTypeOptions(rows) {
  const map = new Map();
  for (const p of rows || []) {
    const key = typeKey(p);
    if (!key) continue;
    const entry = map.get(key) || { value: key, label: typeLabel(p), count: 0 };
    entry.count += 1;
    map.set(key, entry);
  }
  const options = [...map.values()];
  if (options.length < 2 || !options.some((o) => o.count > 1)) return [];
  return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/** Colour options (deduped case-insensitively, swatch order). [] if < 2 colours. */
export function buildColourOptions(rows) {
  const map = new Map();
  for (const p of rows || []) {
    const key = norm(p.colour);
    if (!key) continue;
    const entry = map.get(key) || { value: key, label: p.colour.trim(), hex: p.colour_hex || null, count: 0 };
    entry.count += 1;
    if (!entry.hex && p.colour_hex) entry.hex = p.colour_hex;
    map.set(key, entry);
  }
  const options = sortFamily([...map.values()].map((o) => ({ ...o, colour: o.label })))
    .map(({ colour: _c, ...o }) => o);
  return options.length < 2 ? [] : options;
}

/** Rows matching the selected type and/or colour (either may be empty). */
export function filterFacetRows(rows, { type, colour } = {}) {
  const t = String(type || '').toUpperCase();
  const c = norm(colour);
  return (rows || []).filter((p) => (!t || typeKey(p) === t) && (!c || norm(p.colour) === c));
}
