-- Retire five Palms Off Gaming lines that should not be on sale.
--
-- * CL-35PT / CL-100PT / CL-180PT ("Card Loaders") duplicate TL-35PT /
--   TL-100PT / TL-180PT ("Top Loaders"): same product photos, and the
--   supplier's order form lists only Card Loaders at these sizes. The TL-…
--   lines stay (they cover the full 35–180pt range) and carry the supplier's
--   CL-… SKU in shop_product_costs.supplier_sku.
-- * CMD-1 (single Command Case) and SRGH-50 (50-pack grading holders): the
--   supplier sells only the 10-pack (CMD-10) and 200-pack (SRGH-200), so
--   there is no wholesale price for these pack sizes.
--
-- Archived rather than deleted so order history stays intact; the static
-- catalogue entries (data/palmsOffCatalogue.js) are removed in the same PR
-- so the pages and sitemap entries disappear. Idempotent: only touches rows
-- still in draft with no stock; already-archived rows are untouched, and a
-- row an admin has since activated or stocked is left alone.

update public.shop_products
set status = 'archived', updated_at = now()
where sku in ('CL-35PT', 'CL-100PT', 'CL-180PT', 'CMD-1', 'SRGH-50')
  and status = 'draft'
  and stock_quantity = 0;
