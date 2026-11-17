-- Behavioural checks for the sequential order-numbers migration.
-- Every check raises on failure, so psql exits non-zero and the runner fails.

-- 1. Backfill numbered every pre-existing order, oldest first, ties broken by id.
do $$
declare got text;
begin
  select string_agg(order_number, ',' order by created_at, id) into got from public.orders;
  if got is distinct from 'CP-000001,CP-000002,CP-000003,CP-000004,CP-000005,CP-000006,CP-000007' then
    raise exception 'FAIL backfill order: %', got;
  end if;
  if (select order_number from public.orders where id = 'cccccccc-0000-0000-0000-000000000001') <> 'CP-000001' then
    raise exception 'FAIL: the oldest order is not CP-000001';
  end if;
  if (select order_number from public.orders where id = 'dddddddd-0000-0000-0000-000000000004') <> 'CP-000004' then
    raise exception 'FAIL: tie on created_at was not broken by id';
  end if;
  raise notice 'ok: backfill numbered the existing orders oldest-first';
end $$;

-- 2. The backfill didn't fire the status triggers (no invoices / notifications).
do $$
begin
  if (select count(*) from public.status_trigger_log) <> 0 then
    raise exception 'FAIL: backfilling order_number fired an update-of-status trigger';
  end if;
  raise notice 'ok: backfill is invisible to the status triggers';
end $$;

-- 3. New orders continue the sequence; a supplied number is ignored.
insert into public.orders (id) values ('eeeeeeee-0000-0000-0000-000000000006');
insert into public.orders (id, order_number) values ('eeeeeeee-0000-0000-0000-000000000007', 'CP-000001');
do $$
begin
  if (select order_number from public.orders where id = 'eeeeeeee-0000-0000-0000-000000000006') <> 'CP-000008' then
    raise exception 'FAIL: a new order did not get the next number';
  end if;
  if (select order_number from public.orders where id = 'eeeeeeee-0000-0000-0000-000000000007') <> 'CP-000009' then
    raise exception 'FAIL: a caller-supplied order_number was honoured';
  end if;
  raise notice 'ok: inserts get the next number and a supplied one is overridden';
end $$;

-- 4. A number never changes once issued — not even by an explicit update.
update public.orders set order_number = 'CP-999999' where id = 'cccccccc-0000-0000-0000-000000000001';
update public.orders set order_number = null where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.orders set status = 'completed', total_aud = 12.5 where id = 'cccccccc-0000-0000-0000-000000000001';
do $$
begin
  if (select order_number from public.orders where id = 'cccccccc-0000-0000-0000-000000000001') <> 'CP-000001' then
    raise exception 'FAIL: an issued order number was changed';
  end if;
  if (select order_number from public.orders where id = 'bbbbbbbb-0000-0000-0000-000000000002') <> 'CP-000002' then
    raise exception 'FAIL: an issued order number was cleared';
  end if;
  raise notice 'ok: issued numbers are immutable';
end $$;

-- 5. Unique and NOT NULL are enforced.
do $$
begin
  if (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'orders' and column_name = 'order_number') <> 'NO' then
    raise exception 'FAIL: order_number is nullable';
  end if;
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and tablename = 'orders'
                    and indexname = 'orders_order_number_key' and indexdef ilike '%unique%') then
    raise exception 'FAIL: no unique index on order_number';
  end if;
  raise notice 'ok: order_number is NOT NULL with a unique index';
end $$;

-- 6. Re-applying the migration changes nothing (db push can re-run a straggler)
--    — checked by the runner, which applies it twice; here, confirm the numbers
--    are still one contiguous, duplicate-free run.
do $$
declare n int; d int; mx int;
begin
  select count(*), count(distinct order_number), max(substr(order_number, 4)::int)
    into n, d, mx from public.orders;
  if n <> d then raise exception 'FAIL: duplicate order numbers'; end if;
  if mx <> n then raise exception 'FAIL: gap or overshoot after re-apply (max %, count %)', mx, n; end if;
  raise notice 'ok: % orders, numbers contiguous and unique', n;
end $$;

-- 7. seller_order_numbers(): a seller gets the number of exactly their own sales,
--    whether they are the order's seller_id or one seller inside a cart.
create or replace function pg_temp.as_seller(p_uid text, p_ids uuid[])
returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', p_uid, true);
  select coalesce(string_agg(order_number, ',' order by order_number), '') into r
    from public.seller_order_numbers(p_ids);
  return r;
end $$;

do $$
declare
  ids uuid[] := array['eeee0000-0000-0000-0000-00000000000a', 'eeee0000-0000-0000-0000-00000000000b']::uuid[];
  a text; b text; c text; shop_only text; stranger text;
begin
  a := pg_temp.as_seller('11111111-1111-1111-1111-111111111111', ids);
  b := pg_temp.as_seller('22222222-2222-2222-2222-222222222222', ids);
  c := pg_temp.as_seller('33333333-3333-3333-3333-333333333333', ids);
  shop_only := pg_temp.as_seller('44444444-4444-4444-4444-444444444444', ids);
  stranger := pg_temp.as_seller('99999999-9999-9999-9999-999999999999', ids);
  if a <> (select order_number from public.orders where id = ids[1]) then
    raise exception 'FAIL: the order''s own seller_id did not get its number (%)', a;
  end if;
  if b <> (select order_number from public.orders where id = ids[2]) or c <> b then
    raise exception 'FAIL: cart sellers did not each get the cart order''s number (%, %)', b, c;
  end if;
  if shop_only <> '' then raise exception 'FAIL: a seller of a *shop* line was given a number (%)', shop_only; end if;
  if stranger <> '' then raise exception 'FAIL: a stranger was given order numbers (%)', stranger; end if;
  if (select count(*) from public.seller_order_numbers(null)) <> 0 then
    raise exception 'FAIL: null id list returned rows';
  end if;
  raise notice 'ok: seller_order_numbers returns only the caller''s own sales';
end $$;
