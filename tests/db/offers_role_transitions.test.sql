-- Who may make which offer move (20261110202311_offers_role_bound_transitions.sql).
-- Run by tests/db/run-offer-migrations.sh after the other offer checks.
\set ON_ERROR_STOP on

reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
insert into public.profiles (id, email, is_admin) values
  ('00000000-0000-0000-0000-0000000000e1', 'role-buyer@example.com', false),
  ('00000000-0000-0000-0000-0000000000e2', 'role-seller@example.com', false),
  ('00000000-0000-0000-0000-0000000000e3', 'role-stranger@example.com', false)
on conflict (id) do nothing;
insert into public.vault_items (id, card_name) values ('00000000-0000-0000-0000-0000000000e9', 'Role test card');
insert into public.listings (id, seller_id, vault_item_id, listing_type, status, price_aud) values
  ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e9', 'fixed', 'active', 5000);

-- Four pending $1 offers from the buyer.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false) \g /dev/null
insert into public.offers (id, listing_id, buyer_id, seller_id, amount_aud, binding_acknowledged_at)
select ('00000000-0000-0000-0000-000000000e1' || n)::uuid, '00000000-0000-0000-0000-000000000e01',
       '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 1, now()
from generate_series(1, 4) n;

-- THE BUG: the buyer accepting their own pending offer. Also: declining or
-- countering it (seller moves), and reviving a withdrawn one.
do $$
declare refused int := 0; s text;
begin
  foreach s in array array['accepted', 'declined', 'countered'] loop
    begin
      execute format('update public.offers set status = %L where id = %L', s, '00000000-0000-0000-0000-000000000e11');
      -- Zero rows (policy filtered it) is a refusal too.
      if (select status from public.offers where id = '00000000-0000-0000-0000-000000000e11') = 'pending' then refused := refused + 1; end if;
    exception when insufficient_privilege then refused := refused + 1;
    end;
  end loop;
  assert refused = 3, 'buyer must not accept/decline/counter their own pending offer, refused ' || refused;
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e11') = 'pending', 'offer must still be pending';
  assert (select payment_due_at from public.offers where id = '00000000-0000-0000-0000-000000000e11') is null, 'no payment window opened';
end $$;

-- The buyer's own legitimate move still works.
update public.offers set status = 'withdrawn' where id = '00000000-0000-0000-0000-000000000e14';
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e14') = 'withdrawn', 'buyer can withdraw a pending offer';
end $$;
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000e14';
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e14') = 'withdrawn', 'a withdrawn offer stays withdrawn';
end $$;

-- A stranger can do nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false) \g /dev/null
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000e11';
reset role;
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e11') = 'pending', 'a stranger cannot accept';
end $$;

-- The seller: accept one, decline one, counter one; cannot withdraw.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false) \g /dev/null
do $$
declare refused boolean := false;
begin
  begin
    update public.offers set status = 'withdrawn' where id = '00000000-0000-0000-0000-000000000e11';
    refused := (select status from public.offers where id = '00000000-0000-0000-0000-000000000e11') = 'pending';
  exception when insufficient_privilege then refused := true;
  end;
  assert refused, 'seller must not withdraw the buyer''s offer';
end $$;
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000e11';
update public.offers set status = 'declined' where id = '00000000-0000-0000-0000-000000000e12';
update public.offers set status = 'countered', counter_amount_aud = 4500 where id = '00000000-0000-0000-0000-000000000e13';
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e11') = 'accepted', 'seller can accept';
  assert (select payment_due_at from public.offers where id = '00000000-0000-0000-0000-000000000e11') is not null, 'acceptance opens the payment window';
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e12') = 'declined', 'seller can decline';
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e13') = 'countered', 'seller can counter';
end $$;
-- The seller cannot then accept their own counter on the buyer's behalf.
do $$
declare refused boolean := false;
begin
  begin
    update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000e13';
    refused := (select status from public.offers where id = '00000000-0000-0000-0000-000000000e13') = 'countered';
  exception when insufficient_privilege then refused := true;
  end;
  assert refused, 'seller must not accept their own counter';
end $$;

-- The buyer accepts the counter.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false) \g /dev/null
update public.offers set status = 'accepted' where id = '00000000-0000-0000-0000-000000000e13';
do $$ begin
  assert (select status from public.offers where id = '00000000-0000-0000-0000-000000000e13') = 'accepted', 'buyer can accept a counter';
end $$;

-- The service role (no auth.uid()) is unaffected: the sweep and the webhook.
reset role; select set_config('request.jwt.claim.sub', '', false) \g /dev/null
update public.offers set status = 'expired' where id = '00000000-0000-0000-0000-000000000e11';
update public.offers set status = 'accepted', paid_at = now() where id = '00000000-0000-0000-0000-000000000e11';
do $$ begin
  assert (select paid_at from public.offers where id = '00000000-0000-0000-0000-000000000e11') is not null, 'service role can record a late payment';
end $$;
\echo offers_role_transitions: ok
