-- Checks for 20261029204324_shop_products_availability_rank.sql: the generated
-- tier mirrors availability() in utils/shopFacets.js and follows stock changes.
\set ON_ERROR_STOP 1
insert into public.shop_products (title, status, stock_quantity, created_at) values
  ('in stock',             'active',      5, '2026-01-01'),
  ('sold out',             'active',      0, '2026-01-05'),
  ('pre-order no stock',   'preorder',    0, '2026-01-04'),
  ('pre-order with stock', 'preorder',    3, '2026-01-02'),
  ('coming soon',          'coming_soon', 0, '2026-01-06'),
  ('coming soon stocked',  'coming_soon', 2, '2026-01-03'),
  ('draft sold out',       'draft',       0, '2026-01-01');

do $$
declare r record;
begin
  for r in select title, availability_rank from public.shop_products loop
    if r.title = 'in stock'             and r.availability_rank <> 0 then raise exception 'FAIL: %', r; end if;
    if r.title = 'sold out'             and r.availability_rank <> 3 then raise exception 'FAIL: %', r; end if;
    if r.title = 'pre-order no stock'   and r.availability_rank <> 1 then raise exception 'FAIL: %', r; end if;
    if r.title = 'pre-order with stock' and r.availability_rank <> 1 then raise exception 'FAIL: %', r; end if;
    if r.title = 'coming soon'          and r.availability_rank <> 2 then raise exception 'FAIL: %', r; end if;
    if r.title = 'coming soon stocked'  and r.availability_rank <> 2 then raise exception 'FAIL: %', r; end if;
    if r.title = 'draft sold out'       and r.availability_rank <> 3 then raise exception 'FAIL: %', r; end if;
  end loop;
end $$;

-- The default grid order: buyable first, then newest.
do $$
declare got text;
begin
  select string_agg(title, ' | ' order by availability_rank, created_at desc, id)
    into got
    from public.shop_products
   where status in ('active', 'preorder', 'coming_soon');
  if got <> 'in stock | pre-order no stock | pre-order with stock | coming soon | coming soon stocked | sold out' then
    raise exception 'FAIL: default order was %', got;
  end if;
end $$;

-- Follows stock: selling out demotes, a restock promotes, a status change retiers.
update public.shop_products set stock_quantity = 0 where title = 'in stock';
update public.shop_products set stock_quantity = 4 where title = 'sold out';
update public.shop_products set status = 'active' where title = 'pre-order with stock';
do $$
begin
  if (select availability_rank from public.shop_products where title = 'in stock') <> 3 then raise exception 'FAIL: sell-out not demoted'; end if;
  if (select availability_rank from public.shop_products where title = 'sold out') <> 0 then raise exception 'FAIL: restock not promoted'; end if;
  if (select availability_rank from public.shop_products where title = 'pre-order with stock') <> 0 then raise exception 'FAIL: pre-order going live not retiered'; end if;
end $$;

-- Nobody can write it by hand.
do $$
begin
  begin
    update public.shop_products set availability_rank = 0 where title = 'in stock';
    raise exception 'FAIL: explicit write to availability_rank was accepted';
  exception when generated_always then null;
  end;
end $$;

\echo 'availability_rank: all checks passed'
