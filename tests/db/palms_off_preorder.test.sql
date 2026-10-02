-- Checks for 20261002023756_palms_off_preorder_7_10_days.sql.
\set ON_ERROR_STOP 1
do $$
declare r record;
begin
  for r in select title, status, preorder_eta from public.shop_products where title like 'POG %' or title = 'House soon' loop
    if r.title = 'POG soon priced'   and (r.status <> 'preorder'    or r.preorder_eta <> 'Ships in 7–10 days') then raise exception 'FAIL: %', r; end if;
    if r.title = 'POG soon unpriced' and (r.status <> 'coming_soon' or r.preorder_eta <> 'Ships in 7–10 days') then raise exception 'FAIL: %', r; end if;
    if r.title = 'POG archived'      and (r.status <> 'archived'    or r.preorder_eta <> 'Ships in 7–10 days') then raise exception 'FAIL: %', r; end if;
    if r.title = 'POG live'          and  r.status <> 'active'      then raise exception 'FAIL: %', r; end if;
    if r.title = 'POG custom eta'    and (r.status <> 'preorder'    or r.preorder_eta <> 'Expected mid-November') then raise exception 'FAIL: %', r; end if;
    if r.title = 'House soon'        and (r.status <> 'coming_soon' or r.preorder_eta is not null) then raise exception 'FAIL: %', r; end if;
  end loop;
end $$;
\echo 'palms_off_preorder: all checks passed'
