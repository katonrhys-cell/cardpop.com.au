/**
 * Pure helpers behind scripts/check-merchant-listings.mjs: pull the JSON-LD
 * out of a rendered page, find every schema.org Product node in it (nested in
 * ItemList / @graph too) and say which identifier Google's Merchant listings
 * report would miss — "No global identifier provided (e.g., gtin, brand)".
 *
 * Kept dependency-free and separate from the script so the parsing can be
 * tested against api/prerender.js output, and so the weekly workflow can run
 * the script without `npm ci`.
 */

/** GTIN-8 / UPC-A / EAN-13 / GTIN-14, digits only — what Google accepts. */
export const GTIN_FORMAT = /^([0-9]{8}|[0-9]{12,14})$/;

/** Parsed JSON-LD blocks of an HTML document; an unparsable block is `{ __invalid: '<head of text>' }`. */
export function jsonLdBlocks(html) {
  const blocks = [];
  for (const m of String(html || '').matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blocks.push(JSON.parse(m[1])); } catch { blocks.push({ __invalid: m[1].trim().slice(0, 120) }); }
  }
  return blocks;
}

/** Every node whose @type is (or includes) Product, however deeply nested. */
export function productNodes(value, out = []) {
  if (Array.isArray(value)) { value.forEach((v) => productNodes(v, out)); return out; }
  if (!value || typeof value !== 'object') return out;
  const type = value['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) out.push(value);
  for (const v of Object.values(value)) productNodes(v, out);
  return out;
}

/** Human-readable problems with one Product node's identifiers ([] = fine). */
export function identifierProblems(node) {
  const problems = [];
  const brand = typeof node.brand === 'string' ? node.brand : node.brand?.name;
  const hasBrand = Boolean(String(brand || '').trim());
  const hasMpn = Boolean(String(node.mpn || '').trim());
  const gtins = ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14'].map((k) => node[k]).filter((v) => v != null);
  const validGtin = gtins.some((g) => GTIN_FORMAT.test(String(g).trim()));
  gtins.forEach((g) => { if (!GTIN_FORMAT.test(String(g).trim())) problems.push(`gtin "${g}" is not an 8/12/13/14-digit GTIN`); });
  if (!hasBrand && !hasMpn && !validGtin) problems.push('no global identifier (brand / mpn / gtin)');
  if (node.brand != null && !hasBrand) problems.push('brand present but empty');
  return problems;
}

/**
 * Check one rendered page.
 * @returns {{ products: number, problems: string[] }} — one problem line per
 *   identifier-less or malformed Product, plus one per JSON-LD block that
 *   doesn't parse.
 */
export function checkPageMarkup(html) {
  const blocks = jsonLdBlocks(html);
  const problems = blocks.filter((b) => b.__invalid).map((b) => `JSON-LD block does not parse: ${b.__invalid}…`);
  const nodes = productNodes(blocks.filter((b) => !b.__invalid));
  nodes.forEach((n) => identifierProblems(n).forEach((p) => problems.push(`${n.name || '(unnamed Product)'}: ${p}`)));
  return { products: nodes.length, problems };
}
