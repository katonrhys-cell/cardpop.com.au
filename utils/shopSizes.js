/**
 * Point-size groups: Top Loaders 35pt / 55pt / 75pt… and Mag Lock Card Cases
 * 35pt…180pt are each their own product line (own URL, photos, SKU, price and
 * stock). A size group links those lines so a product page can offer them as a
 * "Point Size" picker, the way colour families do for colours.
 *
 * Groups are derived from the catalogue titles — a line whose short title ends
 * in "<n>pt" joins the group of every other line in its category with the same
 * title before the size — so a new size added to the catalogue shows up in the
 * picker with no extra wiring.
 *
 * Dependency-free (takes the product list as an argument) so it is trivially
 * testable and safe to import anywhere.
 */

const SIZE_TITLE = /^(.*\S)\s+(\d+)\s?pt$/i;

/** Point size (number) from a catalogue product's short title, or null. */
export function pointSizeOf(product) {
  const m = SIZE_TITLE.exec(String(product?.shortTitle || ''));
  return m ? Number(m[2]) : null;
}

/**
 * Every size of the same product as `product`, ascending by point size, each
 * shaped `{ slug, sku, size, label, categorySlug, product }`. Empty when the
 * line has no sized siblings (a lone size is not a choice).
 */
export function sizeGroupFor(product, products) {
  const m = SIZE_TITLE.exec(String(product?.shortTitle || ''));
  if (!m) return [];
  const stem = m[1].toLowerCase();
  const group = (products || [])
    .filter((p) => p.categorySlug === product.categorySlug)
    .map((p) => ({ p, hit: SIZE_TITLE.exec(String(p.shortTitle || '')) }))
    .filter(({ hit }) => hit && hit[1].toLowerCase() === stem)
    .map(({ p, hit }) => ({
      slug: p.slug,
      sku: p.sku,
      size: Number(hit[2]),
      label: `${Number(hit[2])}pt`,
      categorySlug: p.categorySlug,
      product: p,
    }))
    .sort((a, b) => a.size - b.size);
  return group.length > 1 ? group : [];
}

/** URL of one size's page. */
export const sizeProductPath = (option) => `/shop/${option.categorySlug}/${option.slug}`;
