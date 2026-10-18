-- Minimal stand-in for the parts of the Supabase schema the players migration
-- touches. Used by tests/db/run-players-migration.sh only.
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (id uuid primary key, is_admin boolean default false);

create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  card_name text,
  updated_at timestamptz not null default now()
);

create table public.tracked_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  active boolean not null default true
);

-- Tracker rows that exist before the migration runs; the backfill must link
-- the ones whose name starts with a seeded player's name and leave the rest.
insert into public.tracked_cards (slug, name, category) values
  ('lebron-james-topps-rookie', 'LeBron James Topps Rookie', 'basketball'),
  ('luka-doncic-prizm-rookie', 'Luka Dončić Prizm Rookie', 'basketball'),
  ('nick-daicos-rookie', 'Nick Daicos Rookie Card', 'afl'),
  ('nathan-cleary-rookie', 'Nathan Cleary Rookie Card', 'nrl'),
  ('nikola-jokic-hoops-rookie', 'Nikola Jokić NBA Hoops Rookie', 'basketball'),
  ('charizard-base-set', 'Charizard Holo', 'pokemon');

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select, insert, update on public.vault_items to anon, authenticated;
grant select on public.tracked_cards to anon, authenticated;
