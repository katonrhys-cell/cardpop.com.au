-- Behavioural checks for 20261119050236_close_private_data_gaps.sql.
\set ON_ERROR_STOP on
insert into public.profiles (id, username) values
  ('00000000-0000-0000-0000-00000000000a', 'buyer'),
  ('00000000-0000-0000-0000-00000000000b', 'seller'),
  ('00000000-0000-0000-0000-00000000000c', 'owner');
insert into public.events (title, slug, organizer_name, organizer_email, organizer_phone, organiser_id)
  values ('Show', 'show', 'Org', 'private@example.com', '0400000000', '00000000-0000-0000-0000-00000000000c');
insert into public.orders (id, buyer_id, seller_id, status, shipping_name, shipping_address) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'pending', 'Buyer', '1 Secret St'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'payment_confirmed', 'Buyer', '1 Secret St');

-- 1. anon reads public event columns, the view and the policy still work …
set role anon;
do $$ begin
  if (select count(*) from public.events_public) <> 1 then raise exception 'events_public broken for anon'; end if;
  if (select title from public.events where slug = 'show') <> 'Show' then raise exception 'public column unreadable'; end if;
end $$;
-- … but not the private ones.
do $$ begin
  perform organizer_email from public.events;
  raise exception 'FAIL: anon read organizer_email';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform organiser_id from public.events;
  raise exception 'FAIL: anon read organiser_id';
exception when insufficient_privilege then null; end $$;
reset role;
-- Signed-in organisers still edit through select('*').
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  if (select organizer_email from public.events where slug = 'show') <> 'private@example.com' then
    raise exception 'organiser lost own contact columns'; end if;
end $$;
reset role;

-- 2. seller_sale_shipping: pending order hidden, paid order visible.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if exists (select 1 from public.seller_sale_shipping('00000000-0000-0000-0000-0000000000a1')) then
    raise exception 'FAIL: seller read the address of an unpaid order'; end if;
  if (select shipping_address from public.seller_sale_shipping('00000000-0000-0000-0000-0000000000a2')) <> '1 Secret St' then
    raise exception 'paid order address missing'; end if;
end $$;
reset role;

-- 3. trades: an insert is born proposed; an accepted trade can't be reopened.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.trades (id, initiator_id, responder_id, status)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');
do $$ begin
  if (select status from public.trades where id = '00000000-0000-0000-0000-0000000000f1') <> 'proposed' then
    raise exception 'FAIL: trade inserted as accepted'; end if;
end $$;
reset role;
update public.trades set status = 'accepted' where id = '00000000-0000-0000-0000-0000000000f1'; -- the server / accept_trade()
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  update public.trades set status = 'proposed' where id = '00000000-0000-0000-0000-0000000000f1';
  raise exception 'FAIL: accepted trade reopened';
exception when insufficient_privilege then null; end $$;
-- Cancelling a proposal still works.
insert into public.trades (id, initiator_id, responder_id)
  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
update public.trades set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000000f2';
reset role;

-- 4. publicly_listed follows listings, not the owner.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
insert into public.vault_items (id, owner_id, card_name, publicly_listed)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 'Card', true);
do $$ begin
  if (select publicly_listed from public.vault_items where id = '00000000-0000-0000-0000-0000000000e1') then
    raise exception 'FAIL: inserted card born public'; end if;
end $$;
update public.vault_items set publicly_listed = true where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  if (select publicly_listed from public.vault_items where id = '00000000-0000-0000-0000-0000000000e1') then
    raise exception 'FAIL: owner made an unlisted card public'; end if;
end $$;
-- Listing it makes it public through the sync trigger, as before.
insert into public.listings (seller_id, vault_item_id) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000e1');
do $$ begin
  if not (select publicly_listed from public.vault_items where id = '00000000-0000-0000-0000-0000000000e1') then
    raise exception 'FAIL: listing no longer publishes the card'; end if;
end $$;
-- And the owner can't hide a listed card's flag either (it's derived).
update public.vault_items set publicly_listed = false where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  if not (select publicly_listed from public.vault_items where id = '00000000-0000-0000-0000-0000000000e1') then
    raise exception 'FAIL: flag no longer derived'; end if;
end $$;
reset role;

\echo 'private_data_gaps: all checks passed'
