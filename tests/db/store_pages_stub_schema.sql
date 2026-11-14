-- Minimal stand-in for what the store-pages migration finds: the roles,
-- auth.uid(), profiles.is_admin and local_game_stores with its column-level
-- SELECT grant and admin policies. Used by tests/db/run-store-pages-migration.sh only.
create schema if not exists auth;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;

create table public.profiles (id uuid primary key, is_admin boolean not null default false);
grant select on public.profiles to anon, authenticated;

create table public.local_game_stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  suburb text,
  city text not null,
  state text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  address text,
  website text,
  phone text,
  categories text[] not null default '{}',
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitter_email text,
  submitted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.local_game_stores enable row level security;
grant insert, update, delete on public.local_game_stores to anon, authenticated;
grant select (id, slug, name, suburb, city, state, address, website, phone, categories, description, status, created_at, updated_at)
  on public.local_game_stores to anon, authenticated;
create policy local_game_stores_select_access on public.local_game_stores for select
  using (status = 'approved' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins can update stores" on public.local_game_stores for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', true),
  ('00000000-0000-0000-0000-00000000000b', false);
insert into public.local_game_stores (slug, name, city, state, status, submitter_email)
values ('old-shop-sydney', 'Old Shop', 'sydney', 'NSW', 'approved', 'owner@example.com');
