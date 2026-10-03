-- Indexes for browsing a large shop catalogue.
--
-- /shop pages through the publicly visible statuses
-- (`status in ('active','preorder','coming_soon')`) ordered by created_at,
-- price ascending or price descending, always with `id` as the tie-breaker —
-- without one, equal prices/timestamps can reorder between pages and a product
-- shows up twice or not at all.
--
-- The existing single-column indexes (idx_shop_products_status,
-- idx_shop_products_created_at) can't serve filter-plus-ordered-range in one
-- scan, so Postgres sorts the whole visible set on every page. That is fine at
-- 50 products and not fine once the bulk importer has loaded a few thousand.
--
-- Plain (non-concurrent) CREATE INDEX because migrations run inside a
-- transaction; the table is small enough that the brief write lock is a
-- non-issue. Slug and SKU already have unique indexes
-- (shop_products_slug_key / shop_products_sku_key), so neither is repeated here.

create index if not exists idx_shop_products_status_created_at_id
  on public.shop_products (status, created_at desc, id);

create index if not exists idx_shop_products_status_price_asc_id
  on public.shop_products (status, price_aud asc, id);

create index if not exists idx_shop_products_status_price_desc_id
  on public.shop_products (status, price_aud desc, id);
