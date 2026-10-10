-- Behavioural checks for vault_items.publicly_listed, its sync trigger, the
-- rewritten lock trigger and the collapsed public-read policies.
\set ON_ERROR_STOP on
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', false),  -- seller
  ('00000000-0000-0000-0000-00000000000b', false),  -- another member
  ('00000000-0000-0000-0000-0000000000ad', true);   -- admin

do $$
declare
  seller constant uuid := '00000000-0000-0000-0000-00000000000a';
  other  constant uuid := '00000000-0000-0000-0000-00000000000b';
  listed uuid; private_card uuid; featured uuid; locked_card uuid; lid uuid; n int; b boolean;
begin
  -- Four cards: listed, private, featured-but-unlisted, locked-and-listed.
  insert into public.vault_items (owner_id, card_name) values (seller, 'Listed') returning id into listed;
  insert into public.vault_items (owner_id, card_name) values (seller, 'Private') returning id into private_card;
  insert into public.vault_items (owner_id, card_name, is_featured) values (seller, 'Featured', true) returning id into featured;
  insert into public.vault_items (owner_id, card_name, locked) values (seller, 'Locked', true) returning id into locked_card;
  insert into public.vault_images (vault_item_id, storage_path) values (listed, 'a'), (private_card, 'b'), (featured, 'c'), (locked_card, 'd');

  -- Backfill: a listing that existed before the migration marks its card.
  -- (Simulated by inserting through the trigger; same code path.)
  insert into public.listings (vault_item_id, seller_id, status) values (listed, seller, 'active') returning id into lid;
  select publicly_listed into b from public.vault_items where id = listed;
  assert b, 'active listing → publicly_listed';
  select publicly_listed into b from public.vault_items where id = private_card;
  assert not b, 'no listing → not publicly_listed';

  -- Sold keeps it public; archived/removed drop it; back to active restores it.
  update public.listings set status = 'sold' where id = lid;
  select publicly_listed into b from public.vault_items where id = listed; assert b, 'sold stays public';
  update public.listings set status = 'archived' where id = lid;
  select publicly_listed into b from public.vault_items where id = listed; assert not b, 'archived → private';
  update public.listings set status = 'active' where id = lid;
  select publicly_listed into b from public.vault_items where id = listed; assert b, 'active again → public';

  -- Deleting the listing drops it.
  delete from public.listings where id = lid;
  select publicly_listed into b from public.vault_items where id = listed; assert not b, 'deleted listing → private';

  -- A listing moving to another card updates BOTH cards.
  insert into public.listings (vault_item_id, seller_id, status) values (listed, seller, 'active') returning id into lid;
  update public.listings set vault_item_id = private_card where id = lid;
  select publicly_listed into b from public.vault_items where id = listed; assert not b, 'old card loses the flag';
  select publicly_listed into b from public.vault_items where id = private_card; assert b, 'new card gains the flag';
  update public.listings set vault_item_id = listed where id = lid;

  -- The seller lists a LOCKED card: the sync must get through the lock trigger
  -- (it runs as the seller, who is not an admin).
  perform set_config('request.jwt.claim.sub', seller::text, true);
  insert into public.listings (vault_item_id, seller_id, status) values (locked_card, seller, 'active');
  select publicly_listed into b from public.vault_items where id = locked_card; assert b, 'locked card still syncs';

  -- …but the lock still holds for real edits, and an unlock must be pure.
  begin
    update public.vault_items set card_name = 'Renamed' where id = locked_card;
    raise exception 'locked card edit should have been rejected';
  exception when others then
    if sqlerrm not like 'This card is locked%' then raise; end if;
  end;
  begin
    update public.vault_items set locked = false, card_name = 'Renamed' where id = locked_card;
    raise exception 'unlock + edit should have been rejected';
  exception when others then
    if sqlerrm not like 'This card is locked%' then raise; end if;
  end;
  update public.vault_items set locked = false where id = locked_card;
  update public.vault_items set card_name = 'Renamed after unlock' where id = locked_card;
  perform set_config('request.jwt.claim.sub', '', true);

  -- ── Visibility, as anon ───────────────────────────────────────────────────
  set local role anon;
  select count(*) into n from public.vault_items;
  assert n = 3, 'anon sees listed + featured + locked(listed), not private: ' || n;
  select count(*) into n from public.vault_items where id = private_card;
  assert n = 0, 'private card hidden from anon';
  select count(*) into n from public.vault_images;
  assert n = 3, 'anon sees the images of the three visible cards: ' || n;
  reset role;

  -- ── As the owner: everything of theirs ────────────────────────────────────
  perform set_config('request.jwt.claim.sub', seller::text, true);
  set local role authenticated;
  select count(*) into n from public.vault_items; assert n = 4, 'owner sees all four: ' || n;
  select count(*) into n from public.vault_images; assert n = 4, 'owner sees all four images: ' || n;
  reset role;

  -- ── As another member: same as anon ───────────────────────────────────────
  perform set_config('request.jwt.claim.sub', other::text, true);
  set local role authenticated;
  select count(*) into n from public.vault_items; assert n = 3, 'other member sees three: ' || n;
  select count(*) into n from public.vault_images where vault_item_id = private_card;
  assert n = 0, 'other member cannot see the private card''s image';
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Exactly one public SELECT policy on each table now.
  select count(*) into n from pg_policies where tablename = 'vault_items' and cmd = 'SELECT';
  assert n = 1, 'one vault_items SELECT policy: ' || n;
  select count(*) into n from pg_policies where tablename = 'vault_images' and cmd = 'SELECT';
  assert n = 1, 'one vault_images SELECT policy: ' || n;
end $$;

select 'vault_publicly_listed: ok' as result;
