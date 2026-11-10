-- Behavioural checks for 20261110203544_close_direct_write_gaps.sql.
-- Run by tests/db/run-direct-write-gaps-migration.sh.
\set ON_ERROR_STOP on
\set A '''00000000-0000-0000-0000-00000000000a'''
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', true),   -- admin
  ('00000000-0000-0000-0000-00000000000b', false),  -- member / attacker
  ('00000000-0000-0000-0000-00000000000c', false);  -- victim
insert into public.orders (id, buyer_id) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b');
insert into public.vault_items (id, owner_id, card_name) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', 'Own card'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000c', 'Victim card');
insert into public.listings (id, seller_id, vault_item_id, price_aud) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f2', 50);
insert into public.trades (id, initiator_id, responder_id) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null

do $$
declare refused int := 0;
begin
  -- 1. No self-approved refund.
  begin
    insert into public.refunds (order_id, buyer_id, requested_by, status, refund_amount_aud)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'approved', 99999);
  exception when insufficient_privilege then refused := refused + 1; end;
  -- 2. No review without the API.
  begin
    insert into public.seller_ratings (seller_id, reviewer_id, rating)
    values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', 1);
  exception when insufficient_privilege then refused := refused + 1; end;
  -- 4. No listing of someone else's card.
  begin
    insert into public.listings (seller_id, vault_item_id, price_aud)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f2', 1);
  exception when insufficient_privilege then refused := refused + 1; end;
  -- 5. The initiator can't accept their own trade.
  begin
    update public.trades set status = 'accepted' where id = '00000000-0000-0000-0000-000000000301';
  exception when insufficient_privilege then refused := refused + 1; end;
  assert refused = 4, 'four direct writes must be refused, got ' || refused;
end $$;

-- 3. A member's is_featured is dropped on insert; the card itself is saved.
insert into public.vault_items (id, owner_id, card_name, is_featured)
values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000000b', 'Wants the homepage', true);
-- Legitimate writes still work.
insert into public.listings (id, seller_id, vault_item_id, price_aud)
values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f1', 20);
update public.listings set price_aud = 25 where id = '00000000-0000-0000-0000-000000000102';
update public.trades set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000301';
do $$ begin
  assert not (select is_featured from public.vault_items where id = '00000000-0000-0000-0000-0000000000f3'), 'member insert must not be featured';
  assert (select price_aud from public.listings where id = '00000000-0000-0000-0000-000000000102') = 25, 'seller can list and reprice their own card';
  assert (select status from public.trades where id = '00000000-0000-0000-0000-000000000301') = 'cancelled', 'a participant can still cancel';
end $$;
-- Re-pointing an existing listing at the victim's card is refused too.
do $$
declare refused boolean := false;
begin
  begin
    update public.listings set vault_item_id = '00000000-0000-0000-0000-0000000000f2' where id = '00000000-0000-0000-0000-000000000102';
  exception when insufficient_privilege then refused := true; end;
  assert refused, 'a listing cannot be re-pointed at another member''s card';
end $$;

-- An admin: may feature on insert, and may edit another seller's listing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \g /dev/null
insert into public.vault_items (id, owner_id, card_name, is_featured)
values ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000000a', 'Staff pick', true);
update public.listings set price_aud = 60 where id = '00000000-0000-0000-0000-000000000101';

-- The service role is untouched.
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
insert into public.refunds (order_id, buyer_id, requested_by) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
insert into public.seller_ratings (seller_id, reviewer_id, order_id, rating) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 5);
do $$ begin
  assert (select is_featured from public.vault_items where id = '00000000-0000-0000-0000-0000000000f4'), 'admin may feature on insert';
  assert (select price_aud from public.listings where id = '00000000-0000-0000-0000-000000000101') = 60, 'admin can edit another seller''s listing';
  assert (select count(*) from public.refunds) = 1 and (select count(*) from public.seller_ratings) = 1, 'service role writes land';
end $$;
\echo direct_write_gaps: ok
