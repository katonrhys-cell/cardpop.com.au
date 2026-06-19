-- Per-sport teams. A franchise-scoped lookup (e.g. the NBA franchise has the
-- 30 NBA teams) so cards uploaded under a sports franchise can be tagged with a
-- team, and marketplace listings can be filtered by team.
--
-- Modeled on public.manufacturers (franchise_id, slug, logo_url, is_active,
-- sort_order) with the same public-read / admin-manage RLS.

create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null,
  franchise_id uuid references public.categories(id) on delete cascade,
  logo_url     text,
  is_active    boolean default true,
  sort_order   integer default 0,
  created_at   timestamptz default now(),
  unique (franchise_id, slug)
);

create index if not exists teams_franchise_id_idx on public.teams (franchise_id);

alter table public.teams enable row level security;

drop policy if exists "Public read teams" on public.teams;
create policy "Public read teams"
  on public.teams for select
  using (true);

drop policy if exists "Admin manage teams" on public.teams;
create policy "Admin manage teams"
  on public.teams for all
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  ));

-- Link vault items to an optional team.
alter table public.vault_items
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists vault_items_team_id_idx on public.vault_items (team_id);
