-- Behavioural checks for the shop product review migration. Run by
-- tests/db/run-shop-review-migrations.sh against a throwaway Postgres; every
-- check is an ASSERT (or an expected exception), so any failure aborts.
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Sam Buyer', false),
  ('00000000-0000-0000-0000-00000000000c', 'Other Buyer', false);
insert into public.shop_products (id, title, family_sku) values
  ('00000000-0000-0000-0000-0000000000a1', 'Zip Binder - Black', 'ZB-04'),
  ('00000000-0000-0000-0000-0000000000a2', 'Zip Binder - Blue', 'ZB-04'),
  ('00000000-0000-0000-0000-0000000000a3', 'Acrylic Stand', null),
  ('00000000-0000-0000-0000-0000000000a4', 'Not Bought', null);
insert into public.orders (id, buyer_id, status, order_items) values
  ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000000b', 'shipped',
   '[{"type":"shop","id":"00000000-0000-0000-0000-0000000000a1"},{"type":"shop","id":"00000000-0000-0000-0000-0000000000a3"}]'),
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-00000000000b', 'payment_confirmed',
   '[{"type":"shop","id":"00000000-0000-0000-0000-0000000000a1"}]'),
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-00000000000c', 'completed',
   '[{"type":"shop","id":"00000000-0000-0000-0000-0000000000a2"}]');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

-- A buyer can review a product on their shipped order — and cannot publish it.
insert into public.shop_product_reviews (id, product_id, order_id, reviewer_id, rating, title, body, status, moderated_by)
values ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000000b',
        5, '  Great  ', 'Holds heaps', 'published', '00000000-0000-0000-0000-00000000000a');
do $$ declare r record; begin
  select * into r from public.shop_product_reviews where id = '00000000-0000-0000-0000-000000000c01';
  assert r.status = 'pending', 'a client-supplied status must be forced to pending';
  assert r.moderated_by is null and r.moderated_at is null, 'moderation fields must be cleared';
  assert r.pool_key = 'ZB-04', 'pool key should be the family SKU';
  assert r.reviewer_name = 'Sam Buyer', 'reviewer name should be snapshotted from the profile';
  assert r.title = 'Great', 'title should be trimmed';
end $$;

-- A product with no family is pooled by its own id.
insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000000b', 4);
do $$ begin
  assert (select pool_key from public.shop_product_reviews where product_id = '00000000-0000-0000-0000-0000000000a3')
         = '00000000-0000-0000-0000-0000000000a3', 'no-family product should pool by id';
end $$;

-- One review per product per order.
do $$ begin
  begin
    insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000000b', 3);
    raise exception 'duplicate review was accepted';
  exception when unique_violation then null; end;
end $$;

-- Not shipped yet.
do $$ begin
  begin
    insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-00000000000b', 3);
    raise exception 'review on an unshipped order was accepted';
  exception when sqlstate '22023' then null; end;
end $$;

-- A product that is not on the order.
do $$ begin
  begin
    insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000000b', 3);
    raise exception 'review of a product not on the order was accepted';
  exception when sqlstate '22023' then null; end;
end $$;

-- Someone else's order.
do $$ begin
  begin
    insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-00000000000b', 5);
    raise exception 'review on another buyer''s order was accepted';
  exception when sqlstate '42501' then null; end;
end $$;

-- Cannot write as someone else (RLS with check).
do $$ begin
  begin
    insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-00000000000c', 5);
    raise exception 'review as another reviewer was accepted';
  exception when insufficient_privilege then null; end;
end $$;

-- Rating bounds.
do $$ begin
  begin
    insert into public.shop_product_reviews (product_id, order_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000000b', 6);
    raise exception 'rating 6 was accepted';
  exception when check_violation then null; end;
end $$;

-- Pending reviews are visible to their author, not to anyone else.
do $$ begin
  assert (select count(*) from public.shop_product_reviews) = 2, 'author should see their own pending reviews';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  assert (select count(*) from public.shop_product_reviews) = 0, 'a pending review must not be public';
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.shop_product_reviews) = 0, 'anon must not see pending reviews';
end $$;
reset role;

-- Users cannot publish by UPDATE (no policy), and there is no delete either.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    update public.shop_product_reviews set status = 'published' where id = '00000000-0000-0000-0000-000000000c01';
    raise exception 'update granted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Admins were told (service-role insert path of the notify trigger).
do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a') = 2,
    'the admin should have a notification per review';
end $$;

-- Moderation (service role) publishes it; now public, and the stats view agrees.
update public.shop_product_reviews set status = 'published', moderated_at = now()
 where id = '00000000-0000-0000-0000-000000000c01';
set role anon;
do $$ begin
  assert (select count(*) from public.shop_product_reviews) = 1, 'a published review is public';
  assert (select review_count from public.shop_product_review_stats where pool_key = 'ZB-04') = 1, 'stats count published only';
  assert (select average_rating from public.shop_product_review_stats where pool_key = 'ZB-04') = 5.00, 'stats average';
  assert not exists (select 1 from public.shop_product_review_stats where pool_key = '00000000-0000-0000-0000-0000000000a3'),
    'a pending review must not appear in the stats';
end $$;
reset role;

\echo 'shop_reviews: all checks passed'
