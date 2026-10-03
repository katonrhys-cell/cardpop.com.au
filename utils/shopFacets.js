/**
 * Filter chips ("facets") for shop product grids — category pages such as
 * /shop/category/binders, the collection pages and the main /shop grid.
 *
 * Facets are computed client-side from a lightweight list of every product in
 * the page's scope (FACET_SELECT). When any filter is active the page filters
 * and sorts that list itself, then fetches full rows only for the ids on the
 * current page (fetchShopProductsByIds) — so counts and pagination are exact
 * and the request never carries more than one page of ids.
 *
 * Each facet only renders when it would actually narrow the grid (see
 * `minOptions` / `worthShowing`), so a category of single products shows no
 * Type chips, a one-brand category shows no Brand chips, and so on.
 *
 * "Type" is the product line: colour lines are one shop_products row per colour
 * linked by `family_sku` (utils/shopFamily.js), labelled with the title minus
 * the brand prefix and the " — <colour>" suffix the colour split appended.
 */
import { sortFamily } from '@/utils/shopFamily.js';
import { isSoldOut, PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';
import { binderCapacity } from '@/utils/binderCapacity.js';

/** Columns needed to build, filter and sort by the facets. */
export const FACET_SELECT =
  'id, sku, title, brand, category, family_sku, colour, colour_hex, price_aud, retail_price_aud, stock_quantity, status, created_at';

const norm = (s) => String(s || '').trim().toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const natural = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true });

// ─── Per-facet value extraction ─────────────────────────────────────────────

/** Key grouping a product into its line: family SKU, else its own SKU/id. */
export const typeKey = (p) => String(p?.family_sku || p?.sku || p?.id || '').toUpperCase();

/** Human label for a product's line. */
export function typeLabel(p) {
  let title = String(p?.title || '').trim();
  if (p?.colour) {
    title = title.replace(new RegExp(`\\s*[—–-]\\s*${escapeRe(p.colour.trim())}\\s*$`, 'i'), '');
  }
  const brand = String(p?.brand || '').trim();
  if (brand && title.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
    title = title.slice(brand.length + 1);
  }
  return title || p?.sku || 'Other';
}

/** Pockets per page from the title ("9-Pocket Zip Binder" → '9'), else null. */
export function pocketCount(p) {
  const m = String(p?.title || '').match(/\b(\d{1,2})\s*-?\s*pocket\b/i);
  return m ? String(Number(m[1])) : null;
}

/**
 * Binder capacity in slots ('216') for a Palms Off Gaming binder, from
 * utils/binderCapacity.js, else null. Brand-gated: the table is keyed by that
 * brand's SKUs, which another brand could reuse.
 */
export function capacitySlots(p) {
  if (!/palms off/i.test(String(p?.brand || ''))) return null;
  const c = binderCapacity(p?.family_sku) || binderCapacity(p?.sku);
  return c ? String(c.slots) : null;
}

export const PRICE_BANDS = [
  { value: 'under-20', label: 'Under $20', min: 0, max: 20 },
  { value: '20-50', label: '$20 – $50', min: 20, max: 50 },
  { value: '50-100', label: '$50 – $100', min: 50, max: 100 },
  { value: '100-250', label: '$100 – $250', min: 100, max: 250 },
  { value: '250-plus', label: '$250+', min: 250, max: Infinity },
];

export function priceBand(p) {
  const price = Number(p?.price_aud);
  if (!Number.isFinite(price)) return null;
  return PRICE_BANDS.find((b) => price >= b.min && price < b.max)?.value || null;
}

export const AVAILABILITY = [
  { value: 'in-stock', label: 'In stock' },
  { value: 'pre-order', label: 'Pre-order' },
  { value: 'coming-soon', label: 'Coming soon' },
  { value: 'sold-out', label: 'Sold out' },
];

export function availability(p) {
  if (p?.status === 'coming_soon') return 'coming-soon';
  if (isSoldOut(p)) return 'sold-out';
  // A pre-order (unlimited) is buyable but not "in stock" — it gets
  // its own option so in-stock means ships now.
  return p?.status === 'preorder' ? 'pre-order' : 'in-stock';
}

/** Selling below the manufacturer RRP. */
export const onSale = (p) => {
  const price = Number(p?.price_aud);
  const rrp = Number(p?.retail_price_aud);
  return Number.isFinite(price) && Number.isFinite(rrp) && rrp > price;
};

// ─── Facet definitions ──────────────────────────────────────────────────────

const fixedOrder = (list) => (options) =>
  list.map((d) => options.find((o) => o.value === d.value)).filter(Boolean);

/**
 * value(row) → option key (or null), optionLabel(row, key) → display text.
 * `worthShowing(options)` decides whether the facet narrows anything.
 */
export const FACETS = {
  category: {
    label: 'Category',
    value: (p) => norm(p.category) || null,
    optionLabel: (p) => String(p.category).trim(),
    order: (o) => o.sort(natural),
  },
  type: {
    label: 'Type',
    value: (p) => typeKey(p) || null,
    optionLabel: typeLabel,
    order: (o) => o.sort(natural),
    // Every "type" being a single product would just list the products again.
    worthShowing: (o) => o.length >= 2 && o.some((x) => x.count > 1),
  },
  pockets: {
    label: 'Pockets per page',
    value: pocketCount,
    optionLabel: (p, v) => `${v}-pocket`,
    order: (o) => o.sort((a, b) => Number(a.value) - Number(b.value)),
  },
  capacity: {
    label: 'Binder capacity',
    value: capacitySlots,
    optionLabel: (p, v) => `${v} slots`,
    order: (o) => o.sort((a, b) => Number(a.value) - Number(b.value)),
  },
  colour: {
    label: 'Colour',
    swatch: true,
    value: (p) => norm(p.colour) || null,
    optionLabel: (p) => String(p.colour).trim(),
    order: (o) => sortFamily(o.map((x) => ({ ...x, colour: x.label }))).map(({ colour: _c, ...x }) => x),
  },
  brand: {
    label: 'Brand',
    value: (p) => norm(p.brand) || null,
    optionLabel: (p) => String(p.brand).trim(),
    order: (o) => o.sort(natural),
  },
  price: {
    label: 'Price',
    value: priceBand,
    optionLabel: (p, v) => PRICE_BANDS.find((b) => b.value === v).label,
    order: fixedOrder(PRICE_BANDS),
  },
  availability: {
    label: 'Availability',
    value: availability,
    optionLabel: (p, v) => AVAILABILITY.find((a) => a.value === v).label,
    order: fixedOrder(AVAILABILITY),
  },
  sale: {
    label: 'Deals',
    value: (p) => (onSale(p) ? 'on-sale' : null),
    optionLabel: () => 'On sale',
    order: (o) => o,
    // A single "On sale" chip — useful only if some, but not all, are on sale.
    worthShowing: (o, rows) => o.length === 1 && o[0].count < rows.length,
  },
};

/** Facets category / collection pages offer, in display order. */
export const DEFAULT_FACET_KEYS = ['type', 'pockets', 'capacity', 'colour', 'price', 'availability', 'brand', 'sale'];

/**
 * { facetKey: options[] } for the facets worth showing over `rows`.
 * Each option is { value, label, count, hex? }.
 */
export function buildFacetOptions(rows, keys = DEFAULT_FACET_KEYS) {
  const list = rows || [];
  const out = {};
  for (const key of keys) {
    const def = FACETS[key];
    if (!def) continue;
    const map = new Map();
    for (const p of list) {
      const v = def.value(p);
      if (!v) continue;
      const entry = map.get(v) || { value: v, label: def.optionLabel(p, v), count: 0 };
      entry.count += 1;
      if (def.swatch && !entry.hex && p.colour_hex) entry.hex = p.colour_hex;
      map.set(v, entry);
    }
    const options = def.order([...map.values()]);
    const show = def.worthShowing ? def.worthShowing(options, list) : options.length >= 2;
    if (show) out[key] = options;
  }
  return out;
}

// ─── Selection ──────────────────────────────────────────────────────────────

const canonical = (key, value) => (key === 'type' ? String(value).toUpperCase() : norm(value));

/** Read the selection from URL params, keeping only values on offer. */
export function readSelection(params, options) {
  const sel = {};
  for (const [key, opts] of Object.entries(options || {})) {
    const raw = params.get(key);
    if (!raw) continue;
    const v = canonical(key, raw);
    if (opts.some((o) => o.value === v)) sel[key] = v;
  }
  return sel;
}

/** Rows matching every selected facet, optionally ignoring one (for counts). */
export function filterFacetRows(rows, selection = {}, exceptKey = null) {
  const active = Object.entries(selection).filter(([k, v]) => v && k !== exceptKey && FACETS[k]);
  if (active.length === 0) return rows || [];
  return (rows || []).filter((p) => active.every(([k, v]) => FACETS[k].value(p) === canonical(k, v)));
}

/**
 * Per-option counts for one facet given the other selections — so choosing a
 * colour shows which types come in it, and vice versa.
 */
export function facetCounts(rows, selection, key) {
  const counts = new Map();
  const def = FACETS[key];
  for (const p of filterFacetRows(rows, selection, key)) {
    const v = def.value(p);
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

/** Case-insensitive title match, mirroring the grids' `ilike('title', %q%)`. */
export function matchesSearch(row, term) {
  const q = norm(term);
  return !q || norm(row.title).includes(q);
}

/** Sort facet rows the way the grids' server queries do. */
export function sortFacetRows(rows, sort) {
  const price = (p) => Number(p.price_aud) || 0;
  const time = (p) => Date.parse(p.created_at) || 0;
  const list = [...(rows || [])];
  if (sort === 'price_asc') return list.sort((a, b) => price(a) - price(b));
  if (sort === 'price_desc') return list.sort((a, b) => price(b) - price(a));
  if (sort === 'oldest') return list.sort((a, b) => time(a) - time(b));
  return list.sort((a, b) => time(b) - time(a));
}

/** Full rows for `ids`, returned in the same order. */
export async function fetchShopProductsByIds(supabase, ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase.from('shop_products').select('*').in('id', ids).in('status', PUBLIC_SHOP_STATUSES);
  if (error) throw error;
  const byId = new Map((data || []).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
