// JSX-free list of the shop's leaf category pages (/shop/category/<slug>) for
// the serverless functions (api/sitemap.js, api/prerender.js), which can't
// import utils/shopCategories.js because it pulls in icon components.
//
// The built-in leaves come from SHOP_COLLECTION_SEO's `subs` (a test keeps them
// in step with SHOP_CATEGORY_GROUPS), and the admin-editable shop_categories
// overlay is applied with the same rules as mergeShopCategoryGroups(): a
// `hidden` row removes a leaf by name, any other row adds a leaf under its
// section. So the sitemap and prerender advertise exactly the pages the Shop
// menu links to.
import { SHOP_COLLECTION_SEO } from '../data/shopCollectionSeo.js';

// Same rules as utils/shopCategories.js slugifyName / utils/shopProductUrl.js.
const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const nameKey = (name) => String(name || '').trim().toLowerCase();

/**
 * @param {object[]} rows  shop_categories rows { section_slug, name, description, hidden }
 * @returns {{ name, slug, desc, groupSlug, groupName }[]}
 */
export function shopCategoryLeaves(rows = []) {
  const hidden = new Set((rows || []).filter((r) => r.hidden).map((r) => nameKey(r.name)));
  const additions = (rows || []).filter((r) => !r.hidden && nameKey(r.name));
  const leaves = [];
  for (const group of Object.values(SHOP_COLLECTION_SEO)) {
    const taken = new Set();
    const push = (name, slug, desc = '') => {
      taken.add(nameKey(name));
      leaves.push({ name, slug, desc, groupSlug: group.slug, groupName: group.name });
    };
    for (const sub of group.subs) {
      if (!hidden.has(nameKey(sub.name))) push(sub.name, sub.slug);
    }
    for (const row of additions) {
      if (row.section_slug !== group.slug || taken.has(nameKey(row.name))) continue;
      const name = String(row.name).trim();
      push(name, slugify(name), row.description || '');
    }
  }
  return leaves;
}

/**
 * Mirrors the category page's product query (`category ILIKE %name%`), so a
 * page is only advertised when it would actually show something.
 */
export const productInShopCategory = (product, name) =>
  String(product?.category || '').toLowerCase().includes(nameKey(name));
