-- Behavioural checks for the binding-offer migrations. Run by
-- tests/db/run-offer-migrations.sh against a throwaway Postgres; every check
-- is an ASSERT (or an expected exception), so any failure aborts with an error.
\set ON_ERROR_STOP on

insert into public.profiles (id, email, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@cardpop.com.au', true),
  ('00000000-0000-0000-0000-00000000000b', 'buyer@example.com', false),
  ('00000000-0000-0000-0000-00000000000c', 'seller@example.com', false),
  ('00000000-0000-0000-0000-00000000000d', 'other-admin@example.com', true);
insert into public.vault_items (id, card_name) values ('00000000-0000-0000-0000-0000000000f1', 'Kevin Durant RC');
insert into public.listings (id, seller_id, vault_item_id, listing_type, status, price_aud) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'fixed', 'active', 4999.99);
insert into public.listings (id, seller_id, vault_item_id, listing_type, status, price_aud, accepts_offers) values
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'fixed', 'active', 100, false),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'trade', 'active', null, true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f1', 'expression_of_interest', 'active', null, false);

-- New listings default to accepting offers.
do $$ begin
  assert (select accepts_offers from public.listings where id = '00000000-0000-0000-0000-000000000101'), 'accepts_offers should default true';
end $$;

-- Act as the buyer from here on (RLS + auth.uid()).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

-- A buyer cannot mint an accepted $1 offer, a counter, or a long expiry.
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, status, counter_amount_aud, expires_at, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000b',
        '00000000-0000-0000-0000-00000000000c', 1, 'accepted', 1, now() + interval '10 years', now());
do $$
declare o record;
begin
  select * into o from public.offers where id = '00000000-0000-0000-0000-000000000201';
  assert o.status = 'pending', 'insert must force status pending, got ' || o.status;
  assert o.counter_amount_aud is null, 'insert must clear counter';
  assert o.expires_at between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute', 'expiry must be 48h';
end $$;

-- Seller and every non-party admin are notified; the buyer is not.
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.notifications where related_id = '00000000-0000-0000-0000-000000000201' and user_id = '00000000-0000-0000-0000-00000000000c') = 1, 'seller notified once';
  assert (select count(*) from public.notifications where related_id = '00000000-0000-0000-0000-000000000201' and user_id = '00000000-0000-0000-0000-00000000000a') = 1, 'admin@cardpop.com.au notified';
  assert (select count(*) from public.notifications where related_id = '00000000-0000-0000-0000-000000000201' and user_id = '00000000-0000-0000-0000-00000000000d') = 1, 'every admin notified';
  assert (select count(*) from public.notifications where related_id = '00000000-0000-0000-0000-000000000201' and user_id = '00000000-0000-0000-0000-00000000000b') = 0, 'buyer not notified of own offer';
  assert (select link from public.notifications where related_id = '00000000-0000-0000-0000-000000000201' and user_id = '00000000-0000-0000-0000-00000000000a') = '/product/marketplace/00000000-0000-0000-0000-000000000101', 'admin link goes to the listing';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null

-- Refusals: no acknowledgement, offers switched off, trade-only listing. EOI works.
do $$
declare refused int := 0;
begin
  begin
    insert into public.offers (listing_id, buyer_id, seller_id, amount_aud) values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 50);
  exception when check_violation then refused := refused + 1; end;
  begin
    insert into public.offers (listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at) values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 50, now());
  exception when check_violation then refused := refused + 1; end;
  begin
    insert into public.offers (listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at) values ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 50, now());
  exception when check_violation then refused := refused + 1; end;
  assert refused = 3, 'expected 3 refusals, got ' || refused;
  insert into public.offers (listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at) values ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 50, now());
end $$;

-- Buyer can withdraw a pending offer; seller is told.
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 4000, now());
update public.offers set status = 'withdrawn' where id = '00000000-0000-0000-0000-000000000202';
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000202') = 'withdrawn', 'withdraw applied';
  assert exists (select 1 from public.notifications where related_id = '00000000-0000-0000-0000-000000000202' and user_id = '00000000-0000-0000-0000-00000000000c' and title = 'Offer withdrawn'), 'seller told of withdrawal';
end $$;

-- The buyer cannot pull out once the seller accepted (bound).
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000201';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
update public.offers set status = 'withdrawn' where id = '00000000-0000-0000-0000-000000000201';
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000201') = 'accepted', 'accepted offer cannot be withdrawn by buyer';
end $$;

-- Expired pending offer: the seller can no longer accept or counter it.
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 3000, now());
update public.offers set expires_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-000000000203';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$
declare refused int := 0;
begin
  begin update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000203';
  exception when check_violation then refused := refused + 1; end;
  begin update public.offers set status = 'countered', counter_amount_aud = 3500 where id = '00000000-0000-0000-0000-000000000203';
  exception when check_violation then refused := refused + 1; end;
  assert refused = 2, 'expired offer must not be accepted/countered, refused=' || refused;
end $$;

-- A live counter resets the clock to 48h for the buyer.
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
values ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 3000, now());
update public.offers set expires_at = now() + interval '1 hour' where id = '00000000-0000-0000-0000-000000000204';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \g /dev/null
update public.offers set status = 'countered', counter_amount_aud = 4500 where id = '00000000-0000-0000-0000-000000000204';
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$
declare o record;
begin
  select * into o from public.offers where id = '00000000-0000-0000-0000-000000000204';
  assert o.status = 'countered', 'counter applied';
  assert o.expires_at > now() + interval '47 hours', 'counter resets expiry to 48h';
  assert o.responded_at is not null, 'responded_at stamped';
end $$;

-- Sweep: overdue pending/countered offers expire; both parties are told.
select public.expire_stale_offers() as expired_count \gset
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000203') = 'expired', 'stale offer swept';
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000204') = 'countered', 'live counter untouched';
  assert exists (select 1 from public.notifications where related_id = '00000000-0000-0000-0000-000000000203' and user_id = '00000000-0000-0000-0000-00000000000b' and title = 'Offer expired'), 'buyer told of expiry';
end $$;

-- The service role (Stripe webhook) may still record payment of a counter past its expiry.
update public.offers set expires_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-000000000204';
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000204';
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000204') = 'accepted', 'service role exempt';
end $$;

-- Authenticated users cannot run the sweep directly.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
do $$ begin
  begin perform public.expire_stale_offers(); raise exception 'sweep should be denied';
  exception when insufficient_privilege then null; end;
end $$;
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null

select 'ALL OFFER MIGRATION CHECKS PASSED' as result;
