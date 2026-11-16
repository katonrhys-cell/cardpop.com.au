-- What 20261116005126_membership_two_yearly_plans.sql needs on top of the event
-- organiser review stub: the plan columns on profiles (with the five-tier
-- CHECK the migration replaces), listings (quota trigger) and whatnot_shows
-- (insert policy). Used by tests/db/run-membership-plans-migration.sh only.
alter table public.profiles
  add column subscription_tier text not null default 'free',
  add column subscription_status text not null default 'none';
alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'pro', 'premium', 'elite', 'ultimate'));

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  created_at timestamptz not null default now()
);
-- As created by 20260802060100 (15 / 30 / 50 / unlimited); the migration
-- replaces the function behind this trigger.
create or replace function public.enforce_monthly_listing_quota() returns trigger language plpgsql as
$$ begin return new; end $$;
create trigger trg_enforce_monthly_listing_quota before insert on public.listings
  for each row execute function public.enforce_monthly_listing_quota();

create table public.whatnot_shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text
);
alter table public.whatnot_shows enable row level security;
grant select, insert on public.whatnot_shows to authenticated;

-- Pre-migration accounts on the retired tiers.
insert into public.profiles (id, display_name, is_admin, subscription_tier, subscription_status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin',         true,  'ultimate', 'grandfathered'),
  ('00000000-0000-0000-0000-0000000000b1', 'Hobby',         false, 'free',     'none'),
  ('00000000-0000-0000-0000-0000000000b2', 'Was Premium',   false, 'premium',  'active'),
  ('00000000-0000-0000-0000-0000000000b3', 'Was Elite',     false, 'elite',    'active'),
  ('00000000-0000-0000-0000-0000000000b4', 'Ultimate',      false, 'ultimate', 'active'),
  ('00000000-0000-0000-0000-0000000000b5', 'Pro',           false, 'pro',      'active');

-- Events that exist before the migration: one the Ultimate organiser runs
-- (backfilled on), one an admin entered (never spotlighted by membership).
insert into public.events (id, organiser_id, title, status, start_date) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b4', 'Ultimate show', 'approved', '2027-03-01'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', 'Admin-entered show', 'approved', '2027-03-02');
