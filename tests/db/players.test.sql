-- Behavioural checks for 20261018020526_players.sql. Each block raises on
-- failure, so a clean run prints nothing but NOTICEs.
\set ON_ERROR_STOP on

-- 1. Twenty published players were seeded, slugs well-formed, key cards arrays.
do $$
declare n int;
begin
  select count(*) into n from public.players where is_published;
  if n <> 20 then raise exception 'expected 20 seeded players, got %', n; end if;
  if exists (select 1 from public.players where jsonb_typeof(key_cards) <> 'array') then
    raise exception 'key_cards must be a JSON array';
  end if;
  if exists (select 1 from public.players where bio is null or headline is null) then
    raise exception 'every seeded player needs a headline and a bio';
  end if;
  raise notice 'ok: 20 players seeded';
end $$;

-- 2. Backfill linked the tracker cards by name and left the others alone.
do $$
begin
  if (select p.slug from public.tracked_cards tc join public.players p on p.id = tc.player_id where tc.slug = 'lebron-james-topps-rookie') <> 'lebron-james' then
    raise exception 'LeBron tracker card not linked';
  end if;
  if (select p.slug from public.tracked_cards tc join public.players p on p.id = tc.player_id where tc.slug = 'luka-doncic-prizm-rookie') <> 'luka-doncic' then
    raise exception 'Dončić tracker card not linked';
  end if;
  if (select p.slug from public.tracked_cards tc join public.players p on p.id = tc.player_id where tc.slug = 'nick-daicos-rookie') <> 'nick-daicos' then
    raise exception 'Daicos tracker card not linked';
  end if;
  if (select p.slug from public.tracked_cards tc join public.players p on p.id = tc.player_id where tc.slug = 'nathan-cleary-rookie') <> 'nathan-cleary' then
    raise exception 'Cleary tracker card not linked';
  end if;
  if exists (select 1 from public.tracked_cards where slug in ('nikola-jokic-hoops-rookie', 'charizard-base-set') and player_id is not null) then
    raise exception 'a tracker card with no seeded player was linked';
  end if;
  raise notice 'ok: tracker backfill';
end $$;

-- 2b. born_on (20261018083926): LeBron's date of birth and team, year kept in step.
do $$
declare r record;
begin
  select born_on, born_year, team into r from public.players where slug = 'lebron-james';
  if r.born_on <> date '1984-12-30' then raise exception 'LeBron born_on not set: %', r.born_on; end if;
  if r.born_year <> 1984 then raise exception 'born_year not derived from born_on: %', r.born_year; end if;
  if r.team <> 'Philadelphia 76ers' then raise exception 'LeBron team not updated: %', r.team; end if;
  -- Setting a full date overrides a stale year; clearing it leaves the year alone.
  update public.players set born_on = date '1990-05-05', born_year = 1900 where slug = 'lebron-james';
  if (select born_year from public.players where slug = 'lebron-james') <> 1990 then
    raise exception 'trigger did not sync born_year from born_on';
  end if;
  update public.players set born_on = null where slug = 'lebron-james';
  if (select born_year from public.players where slug = 'lebron-james') <> 1990 then
    raise exception 'clearing born_on must not clear born_year';
  end if;
  update public.players set born_on = date '1984-12-30' where slug = 'lebron-james';
  begin
    update public.players set born_on = date '1700-01-01' where slug = 'lebron-james';
    raise exception 'out-of-range born_on accepted';
  exception when check_violation then null;
  end;
  raise notice 'ok: born_on';
end $$;

-- 3. RLS: anon reads published rows only; a non-admin cannot write; an admin can.
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-000000000001', false),
  ('00000000-0000-0000-0000-000000000002', true);
insert into public.players (slug, name, sport, is_published) values ('draft-player', 'Draft Player', 'NBA', false);

set role anon;
do $$
declare n int;
begin
  select count(*) into n from public.players where slug = 'draft-player';
  if n <> 0 then raise exception 'anon can see an unpublished player'; end if;
  select count(*) into n from public.players where slug = 'lebron-james';
  if n <> 1 then raise exception 'anon cannot see a published player'; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
begin
  begin
    insert into public.players (slug, name, sport) values ('sneaky', 'Sneaky Insert', 'NBA');
    raise exception 'non-admin inserted a player';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.players set bio = 'vandalised' where slug = 'lebron-james';
    if found then raise exception 'non-admin updated a player'; end if;
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.players where slug = 'draft-player') then
    raise exception 'non-admin can see an unpublished player';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
begin
  insert into public.players (slug, name, sport) values ('new-player', 'New Player', 'NFL');
  update public.players set headline = 'edited' where slug = 'new-player';
  if (select headline from public.players where slug = 'new-player') <> 'edited' then
    raise exception 'admin update did not apply';
  end if;
  if not exists (select 1 from public.players where slug = 'draft-player') then
    raise exception 'admin cannot see an unpublished player';
  end if;
  delete from public.players where slug = 'new-player';
  raise notice 'ok: RLS';
end $$;
reset role;

-- 4. Slug format is enforced; updated_at moves on edit.
do $$
begin
  begin
    insert into public.players (slug, name, sport) values ('Bad Slug!', 'Bad', 'NBA');
    raise exception 'malformed slug accepted';
  exception when check_violation then null;
  end;
  update public.players set team = 'Edited' where slug = 'draft-player';
  if (select updated_at from public.players where slug = 'draft-player') <= (select created_at from public.players where slug = 'draft-player') then
    raise exception 'updated_at did not advance';
  end if;
  raise notice 'ok: constraints';
end $$;

-- 5. vault_items.player_id: FK enforced, and deleting a player unlinks the card
--    rather than deleting it.
do $$
declare vid uuid; pid uuid;
begin
  begin
    insert into public.vault_items (owner_id, card_name, player_id)
      values ('00000000-0000-0000-0000-000000000001', 'Orphan', gen_random_uuid());
    raise exception 'dangling player_id accepted';
  exception when foreign_key_violation then null;
  end;
  select id into pid from public.players where slug = 'draft-player';
  insert into public.vault_items (owner_id, card_name, player_id)
    values ('00000000-0000-0000-0000-000000000001', 'Tagged', pid) returning id into vid;
  delete from public.players where id = pid;
  if (select player_id from public.vault_items where id = vid) is not null then
    raise exception 'player_id not cleared on player delete';
  end if;
  raise notice 'ok: vault_items.player_id';
end $$;
