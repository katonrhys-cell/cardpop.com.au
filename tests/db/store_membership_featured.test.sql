-- Checks for 20261117111555_store_membership_featured.sql.
-- a = admin (complimentary Ultimate), b = a member who owns Swap Itt, c = another member.
\set ON_ERROR_STOP 1
do $$
declare f boolean;
begin
  -- Backfill: b was already Ultimate and owned the shop before the migration.
  select membership_featured into f from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert f, 'backfill should feature an Ultimate owner''s shop';
  select membership_featured into f from public.local_game_stores where slug = 'old-shop-sydney';
  assert not f, 'a shop with no owner is not featured';

  -- The membership ends: the shop stops being featured.
  update public.profiles set subscription_tier = 'free' where id = '00000000-0000-0000-0000-00000000000b';
  select membership_featured into f from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert not f, 'featuring should end with the membership';

  -- Nobody sets the flag by hand — not even the service role.
  update public.local_game_stores set membership_featured = true where slug in ('swap-itt-melbourne', 'old-shop-sydney');
  select bool_or(membership_featured) into f from public.local_game_stores;
  assert not f, 'the flag was set by hand';

  -- Upgrading features every shop the member owns.
  update public.local_game_stores set owner_id = '00000000-0000-0000-0000-00000000000b' where slug = 'old-shop-sydney';
  update public.profiles set subscription_tier = 'ultimate' where id = '00000000-0000-0000-0000-00000000000b';
  select bool_and(membership_featured) into f from public.local_game_stores where owner_id = '00000000-0000-0000-0000-00000000000b';
  assert f, 'upgrade should feature the member''s shops';

  -- Handing a shop to a non-Ultimate member, or removing its owner, un-features it.
  update public.local_game_stores set owner_id = '00000000-0000-0000-0000-00000000000c' where slug = 'old-shop-sydney';
  select membership_featured into f from public.local_game_stores where slug = 'old-shop-sydney';
  assert not f, 'a non-Ultimate owner''s shop is not featured';
  update public.local_game_stores set owner_id = null where slug = 'swap-itt-melbourne';
  select membership_featured into f from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert not f, 'removing the owner should un-feature the shop';

  -- An admin's complimentary Ultimate never features a shop.
  update public.local_game_stores set owner_id = '00000000-0000-0000-0000-00000000000a' where slug = 'swap-itt-melbourne';
  select membership_featured into f from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert not f, 'an admin''s shop was featured';
end $$;

-- The owner's own edit can't feature their shop, and the public can read the flag.
update public.local_game_stores set owner_id = '00000000-0000-0000-0000-00000000000c' where slug = 'swap-itt-melbourne';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update public.local_game_stores set membership_featured = true, phone = '03 9111 1111' where slug = 'swap-itt-melbourne';
reset role;
set role anon;
do $$
declare r record;
begin
  select phone, membership_featured into r from public.local_game_stores where slug = 'swap-itt-melbourne';
  assert r.phone = '03 9111 1111' and not r.membership_featured, 'owner featured their own shop';
end $$;
reset role;
select 'store membership featured migration: ok' as result;
