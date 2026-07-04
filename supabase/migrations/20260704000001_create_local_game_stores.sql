-- Local game store directory: powers the public /card-shops pages.
-- Rows arrive two ways: curated seed data (approved) and public "add your
-- store" submissions (pending, written by the backend service role, promoted
-- to approved from the admin page).

create table if not exists public.local_game_stores (
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
  -- Contact for submissions so an owner can be reached about their listing.
  submitter_email text,
  submitted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists local_game_stores_city_idx
  on public.local_game_stores (city) where status = 'approved';
create index if not exists local_game_stores_state_idx
  on public.local_game_stores (state) where status = 'approved';

alter table public.local_game_stores enable row level security;

-- The public directory shows approved stores only.
drop policy if exists "Public can read approved stores" on public.local_game_stores;
create policy "Public can read approved stores"
  on public.local_game_stores for select
  using (status = 'approved');

-- Admins moderate submissions from the admin dashboard (anon-key client, so
-- RLS applies) — mirrors the admin policies on public.listings.
drop policy if exists "Admins can read all stores" on public.local_game_stores;
create policy "Admins can read all stores"
  on public.local_game_stores for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "Admins can update stores" on public.local_game_stores;
create policy "Admins can update stores"
  on public.local_game_stores for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "Admins can delete stores" on public.local_game_stores;
create policy "Admins can delete stores"
  on public.local_game_stores for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- No insert policy: public submissions go through the backend (service role,
-- bypasses RLS) so they can be validated and rate limited.
