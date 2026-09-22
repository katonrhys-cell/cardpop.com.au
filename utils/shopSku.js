/**
 * SKU helpers for shop products.
 *
 * Convention (mirrors the DB trigger in
 * supabase/migrations/*_shop_products_sku_required.sql): SKUs are stored
 * trimmed and upper-cased. Wholesale lines keep the brand's SKU (Palms Off
 * Gaming: ZB-09, MAG-35PT…); CardPop house products use CP-<SLUG>.
 */

export const SKU_MAX_LENGTH = 64;
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._/-]*$/;

/** Trim + upper-case, the stored form. */
export function normalizeSku(value) {
  return String(value ?? '').trim().toUpperCase();
}

/** True when the normalised SKU is acceptable for saving. */
export function isValidSku(value) {
  const sku = normalizeSku(value);
  return sku.length > 0 && sku.length <= SKU_MAX_LENGTH && SKU_PATTERN.test(sku);
}

/**
 * Suggest a CP-<SLUG> SKU from a product title, e.g.
 * "Acrylic Card Stand - 5 Pack" → "CP-ACRYLIC-CARD-STAND-5-PACK".
 * Returns '' when the title has nothing usable.
 */
export function suggestSku(title, prefix = 'CP') {
  const core = String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!core) return '';
  const full = `${prefix}-${core}`;
  return full.length > SKU_MAX_LENGTH ? full.slice(0, SKU_MAX_LENGTH).replace(/-+$/, '') : full;
}
