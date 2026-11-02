// Which accounting account and tax type each invoice line posts to.
//
// An invoice line carries a `kind` (set by issue_invoice_for_order in the
// database — see supabase/migrations/20261102074307_order_invoices.sql); this
// module turns a kind into the Xero account code and tax type the line should
// be coded to. The mapping is DATA: the two platform_settings rows
// `invoice_xero_account_codes` / `invoice_xero_tax_types` (JSON objects, kind →
// value) override the defaults here, so an accountant can re-code lines
// without a deploy. Dependency-free so the export helpers stay unit-testable.
//
// The defaults are Xero's standard Australian chart of accounts: 200 Sales,
// 260 Other Revenue, 860 Rounding, plus 835 as a liability clearing account
// for money that belongs to a marketplace seller (the card and their postage
// are the SELLER's supply, held by CardPop until payout — not CardPop's
// income; see docs/order-pricing.md). Create that account in Xero, or point
// the setting at the one you use, before the first import.

export const LINE_KINDS = Object.freeze([
  'shop_item',
  'marketplace_item',
  'shop_shipping',
  'seller_shipping',
  'commission',
  'processing_fee',
  'discount',
  'adjustment',
]);

export const LINE_KIND_LABELS = Object.freeze({
  shop_item: 'Shop item',
  marketplace_item: 'Marketplace card',
  shop_shipping: 'Shop shipping',
  seller_shipping: 'Seller postage',
  commission: 'Service fee',
  processing_fee: 'Payment processing',
  discount: 'Discount',
  adjustment: 'Rounding adjustment',
});

export const DEFAULT_XERO_ACCOUNT_CODES = Object.freeze({
  shop_item: '200',
  shop_shipping: '200',
  marketplace_item: '835',
  seller_shipping: '835',
  commission: '260',
  processing_fee: '260',
  discount: '200',
  adjustment: '860',
});

// Xero API tax type codes (AU). OUTPUT = "GST on Income", BASEXCLUDED =
// "BAS Excluded", EXEMPTOUTPUT = "GST Free Income".
export const DEFAULT_XERO_TAX_TYPES = Object.freeze({
  shop_item: 'OUTPUT',
  shop_shipping: 'OUTPUT',
  marketplace_item: 'BASEXCLUDED',
  seller_shipping: 'BASEXCLUDED',
  commission: 'OUTPUT',
  processing_fee: 'OUTPUT',
  discount: 'OUTPUT',
  adjustment: 'BASEXCLUDED',
});

// The names Xero's CSV import expects for the same tax types (the API takes
// the codes, the import template takes the labels).
export const XERO_TAX_TYPE_LABELS = Object.freeze({
  OUTPUT: 'GST on Income',
  INPUT: 'GST on Expenses',
  EXEMPTOUTPUT: 'GST Free Income',
  EXEMPTEXPENSES: 'GST Free Expenses',
  BASEXCLUDED: 'BAS Excluded',
  NONE: 'BAS Excluded',
});

/** Accept a JSON object, a JSON string of one, or anything else (→ {}). */
const asObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const mergeKnownKinds = (defaults, override) => {
  const out = { ...defaults };
  for (const kind of LINE_KINDS) {
    const v = override[kind];
    if (typeof v === 'string' && v.trim()) out[kind] = v.trim();
  }
  return out;
};

/**
 * Build the kind → account / tax mapping from the raw platform_settings values
 * (either may be undefined, an object or a JSON string). Unknown kinds in the
 * settings are ignored; blank values fall back to the default.
 */
export function resolveAccountMapping(settings = {}) {
  return {
    accountCodes: mergeKnownKinds(DEFAULT_XERO_ACCOUNT_CODES, asObject(settings.invoice_xero_account_codes)),
    taxTypes: mergeKnownKinds(DEFAULT_XERO_TAX_TYPES, asObject(settings.invoice_xero_tax_types)),
  };
}

export const accountCodeFor = (kind, mapping) =>
  mapping?.accountCodes?.[kind] ?? DEFAULT_XERO_ACCOUNT_CODES[kind] ?? DEFAULT_XERO_ACCOUNT_CODES.adjustment;

export const taxTypeFor = (kind, mapping) =>
  mapping?.taxTypes?.[kind] ?? DEFAULT_XERO_TAX_TYPES[kind] ?? 'BASEXCLUDED';

export const taxTypeLabel = (code) => XERO_TAX_TYPE_LABELS[code] ?? code;
