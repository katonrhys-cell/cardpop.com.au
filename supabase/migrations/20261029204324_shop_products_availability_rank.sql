-- Shop grids show what can be bought first.
--
-- Every shop grid (/shop, the category, collection, singles and sealed pages)
-- orders by this column before the shopper's chosen sort, so an in-stock
-- product always outranks a sold-out one whatever the sort — "newest" or
-- "price: low to high" no longer opens on a row of things nobody can buy.
-- PostgREST can only order by a column, not an expression, so the tier is a
-- stored generated column kept by Postgres from `status` + `stock_quantity`
-- (the variants trigger already derives `stock_quantity`, so a product sold by
-- colour variant is covered too). It mirrors `availability()` in
-- utils/shopFacets.js, which sorts the filtered (client-side) grid:
--
--   0  in stock      active with stock (ships now)
--   1  pre-order     buyable now, dispatched when stock arrives (unlimited)
--   2  coming soon   visible, enquiry only
--   3  sold out      tracks stock and has none
--
-- Nothing writes to it — a generated column refuses explicit values — and the
-- storefront falls back to the plain sort if it hasn't landed yet
-- (`orderedShopQuery()` in utils/shopFacets.js), so the app can deploy either
-- side of this migration. Idempotent: re-running is a no-op.
alter table public.shop_products
  add column if not exists availability_rank smallint
  generated always as (
    case
      when status = 'coming_soon' then 2
      when status <> 'preorder' and stock_quantity <= 0 then 3
      when status = 'preorder' then 1
      else 0
    end
  ) stored;

comment on column public.shop_products.availability_rank is
  'Browse tier, generated from status + stock_quantity: 0 in stock, 1 pre-order, 2 coming soon, 3 sold out. Shop grids order by it before the chosen sort so buyable products lead. Mirrors availability() in utils/shopFacets.js.';

-- The default browse shape: public statuses, buyable first, newest first,
-- with the id tie-breaker every grid appends for stable paging.
create index if not exists idx_shop_products_status_rank_created_at_id
  on public.shop_products (status, availability_rank, created_at desc, id);
