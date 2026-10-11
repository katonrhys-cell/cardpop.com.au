// Column projection for `shop_products` rows in grids, strips and facets.
//
// Everything a product card, grid filter, JSON-LD identifier or cart line reads
// — i.e. the whole row except `description` (the long marketing copy, only the
// product page shows it) and `created_by`. `description` was riding along with
// every grid, search result and facet row: 275 products × a paragraph each, on
// every shop page view. Dependency-free so the backend can import it too.
//
// Every name here exists on the live table (checked 2026-10-10). An explicit
// select of a missing column is a PostgREST 400, so add new columns only after
// their migration has been applied.
export const SHOP_CARD_COLUMNS = [
  'id',
  'title',
  'price_aud',
  'retail_price_aud',
  'stock_quantity',
  'product_type',
  'category',
  'image_url',
  'images',
  'slug',
  'status',
  'brand',
  'sku',
  'barcode',
  'has_variants',
  'family_sku',
  'colour',
  'colour_hex',
  'preorder_eta',
  'created_at',
  'updated_at',
].join(',');
