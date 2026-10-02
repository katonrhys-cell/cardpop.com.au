-- Behavioural checks for the pre-order migration. Run by
-- tests/db/run-preorder-migration.sh after the migration (applied twice).
\set ON_ERROR_STOP 1

insert into public.profiles (id, is_admin) values ('00000000-0000-0000-0000-00000000000a', true);
insert into public.shop_products (id, title, status) values
  ('00000000-0000-0000-0000-000000000001', 'Live',     'active'),
  ('00000000-0000-0000-0000-000000000003', 'Hidden',   'draft');

-- A pre-order with an estimate is accepted …
insert into public.shop_products (id, title, status, preorder_eta, stock_quantity)
values ('00000000-0000-0000-0000-000000000002', 'Pre', 'preorder', 'Ships in 4–6 weeks', 10);
insert into public.shop_product_variants (product_id, colour)
values ('00000000-0000-0000-0000-000000000002', 'Red');

-- … one without (or blank) is refused, on insert and on update.
do $$ begin
  insert into public.shop_products (title, status) values ('No ETA', 'preorder');
  raise exception 'FAIL: pre-order without an estimate was accepted';
exception when check_violation then null; end $$;
do $$ begin
  update public.shop_products set status = 'preorder', preorder_eta = '   ' where title = 'Live';
  raise exception 'FAIL: blank estimate was accepted';
exception when check_violation then null; end $$;
do $$ begin
  update public.shop_products set preorder_eta = repeat('x', 121) where title = 'Pre';
  raise exception 'FAIL: over-long estimate was accepted';
exception when check_violation then null; end $$;

-- Flipping back to active keeps the text (allowed), coming_soon still valid.
update public.shop_products set status = 'coming_soon' where title = 'Hidden';
do $$ begin
  update public.shop_products set status = 'bogus' where title = 'Live';
  raise exception 'FAIL: unknown status accepted';
exception when check_violation then null; end $$;

-- Anonymous readers see active + preorder + coming_soon, and pre-order variants.
set role anon;
do $$ declare n int; v int; begin
  select count(*) into n from public.shop_products;
  if n <> 3 then raise exception 'FAIL: anon sees % products, expected 3', n; end if;
  select count(*) into v from public.shop_product_variants;
  if v <> 1 then raise exception 'FAIL: anon sees % variants of a pre-order, expected 1', v; end if;
end $$;
reset role;

update public.shop_products set status = 'draft' where title = 'Pre';
set role anon;
do $$ declare v int; begin
  select count(*) into v from public.shop_product_variants;
  if v <> 0 then raise exception 'FAIL: variants of a draft product are public'; end if;
end $$;
reset role;

\echo 'preorder_status: all checks passed'
