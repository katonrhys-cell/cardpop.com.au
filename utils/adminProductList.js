// Filtering, sorting and sectioning for the admin Shop Products table
// (pages/admin/ProductManagementPage.jsx). Pure functions so the list logic is
// testable without rendering the page.
//
// Sections mirror the storefront: a product's `category` is a leaf name from
// utils/shopCategories.js, and its section is that leaf's parent group
// (Protection, Storage, Display, Shipping, Grading). Anything whose category
// isn't in the taxonomy lands in a trailing "Other" section so it can't hide.
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';
import { grossMargin } from '@/src/utils/shopRrp.js';

export const OTHER_SECTION = 'Other';
export const UNCATEGORISED = 'Uncategorised';

// Category name (lower-cased) → { section, sectionIndex, categoryIndex }, so
// sections and categories list in the same order as the Shop menu. Built per
// groups list: the page passes the admin-edited groups (custom categories
// added, removed ones dropped — hooks/useShopCategoryGroups.js), so a removed
// category's products fall into "Other" where they can't hide.
const INDEX_CACHE = new WeakMap();
function categoryIndex(groups = SHOP_CATEGORY_GROUPS) {
  if (INDEX_CACHE.has(groups)) return INDEX_CACHE.get(groups);
  const index = new Map();
  groups.forEach((group, sectionIndex) => {
    group.items.forEach((item, idx) => {
      index.set(item.name.toLowerCase(), { section: group.label, sectionIndex, categoryIndex: idx });
    });
  });
  INDEX_CACHE.set(groups, index);
  return index;
}

export const SECTION_NAMES = [...SHOP_CATEGORY_GROUPS.map((g) => g.label), OTHER_SECTION];

export function sectionOf(product, groups) {
  return categoryIndex(groups).get(String(product?.category || '').trim().toLowerCase())?.section ?? OTHER_SECTION;
}

function categoryLabel(product) {
  return String(product?.category || '').trim() || UNCATEGORISED;
}

// Status order used when sorting by status — the order an admin works through.
const STATUS_ORDER = { active: 0, preorder: 1, coming_soon: 2, draft: 3, archived: 4 };

// Value readers per sortable column. `ctx.costs` is the admin-only cost map
// keyed by product id (shop_product_costs rows).
const SORT_VALUES = {
  title: (p) => String(p.title || '').toLowerCase(),
  sku: (p) => String(p.sku || '').toLowerCase(),
  category: (p) => categoryLabel(p).toLowerCase(),
  price: (p) => numberOrNull(p.price_aud),
  rrp: (p) => numberOrNull(p.retail_price_aud),
  cost: (p, ctx) => numberOrNull(ctx.costs?.[p.id]?.wholesale_inc_gst_aud),
  margin: (p, ctx) => grossMargin(p.price_aud, ctx.costs?.[p.id]?.wholesale_ex_gst_aud),
  status: (p) => STATUS_ORDER[p.status] ?? 99,
  stock: (p) => numberOrNull(p.stock_quantity),
};

export const SORT_KEYS = Object.keys(SORT_VALUES);

function numberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Apply the search box and dropdown filters.
 *
 * @param {object[]} products
 * @param {object} filters  { search, section, category, status, brand } — '' / 'all' means no filter
 * @param {object} [ctx]    { variantsByProduct, groups } — colour SKUs/barcodes/colours are searchable too;
 *                          `groups` is the (admin-edited) taxonomy used for sections
 */
export function filterProducts(products, filters = {}, ctx = {}) {
  const term = String(filters.search || '').trim().toLowerCase();
  const on = (v) => v && v !== 'all';
  return (products || []).filter((p) => {
    if (on(filters.status) && p.status !== filters.status) return false;
    if (on(filters.section) && sectionOf(p, ctx.groups) !== filters.section) return false;
    if (on(filters.category) && categoryLabel(p) !== filters.category) return false;
    if (on(filters.brand) && (String(p.brand || '').trim() || 'CardPop') !== filters.brand) return false;
    if (!term) return true;
    if ([p.title, p.category, p.sku, p.brand, p.colour, p.family_sku].some((f) => f?.toLowerCase().includes(term))) return true;
    if (p.barcode?.includes(term)) return true;
    // Barcode scanner / colour SKU lookups land on the parent product.
    return (ctx.variantsByProduct?.[p.id] || []).some((v) =>
      v.sku?.toLowerCase().includes(term) || v.barcode?.includes(term) || v.colour?.toLowerCase().includes(term));
  });
}

/**
 * Sort by a column. Blanks (no RRP, no cost…) always sink to the bottom in
 * either direction so they never crowd the top of the list; ties fall back to
 * the product name so the order is stable.
 */
export function sortProducts(products, sortKey = 'title', direction = 'asc', ctx = {}) {
  const read = SORT_VALUES[sortKey] || SORT_VALUES.title;
  const dir = direction === 'desc' ? -1 : 1;
  return [...(products || [])].sort((a, b) => {
    const va = read(a, ctx);
    const vb = read(b, ctx);
    const aBlank = va === null || va === undefined;
    const bBlank = vb === null || vb === undefined;
    if (aBlank !== bBlank) return aBlank ? 1 : -1;
    if (!aBlank && va !== vb) return (va < vb ? -1 : 1) * dir;
    return SORT_VALUES.title(a).localeCompare(SORT_VALUES.title(b));
  });
}

/**
 * Split an already-sorted list into sections → categories, in Shop-menu order.
 * Row order inside each category is preserved, so the chosen sort still applies.
 *
 * @returns {{ section: string, count: number, categories: { category: string, products: object[] }[] }[]}
 */
export function groupProducts(products, groups) {
  const index = categoryIndex(groups);
  const sections = new Map();
  for (const p of products || []) {
    const section = sectionOf(p, groups);
    const category = categoryLabel(p);
    if (!sections.has(section)) sections.set(section, new Map());
    const cats = sections.get(section);
    if (!cats.has(category)) cats.set(category, []);
    cats.get(category).push(p);
  }
  const sectionRank = (name) => {
    const i = SECTION_NAMES.indexOf(name);
    return i === -1 ? SECTION_NAMES.length : i;
  };
  const categoryRank = (name) => index.get(name.toLowerCase())?.categoryIndex ?? Number.MAX_SAFE_INTEGER;
  return [...sections.entries()]
    .sort(([a], [b]) => sectionRank(a) - sectionRank(b))
    .map(([section, cats]) => {
      const categories = [...cats.entries()]
        .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
        .map(([category, items]) => ({ category, products: items }));
      return { section, count: categories.reduce((n, c) => n + c.products.length, 0), categories };
    });
}

/** Distinct categories present in the list (optionally within one section), Shop-menu order. */
export function categoryOptions(products, section, groups) {
  const names = new Set();
  for (const p of products || []) {
    if (section && section !== 'all' && sectionOf(p, groups) !== section) continue;
    names.add(categoryLabel(p));
  }
  return groupProducts([...names].map((category) => ({ category: category === UNCATEGORISED ? '' : category })), groups)
    .flatMap((s) => s.categories.map((c) => c.category));
}

/** Distinct brands present in the list; a blank brand is a CardPop house product. */
export function brandOptions(products) {
  return [...new Set((products || []).map((p) => String(p.brand || '').trim() || 'CardPop'))].sort((a, b) => a.localeCompare(b));
}
