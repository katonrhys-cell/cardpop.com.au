-- Minimal stand-in for the parts of the Supabase schema the listing-approval
-- migrations touch. Used by tests/db/run-listing-approval-migrations.sh only.
create extension if not exists "uuid-ossp";
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Mirrors production's enum, which was created before this repository and has
-- no 'pending' value of its own: 20261031134827_listing_status_pending_value
-- adds it, and the runner applies that migration before the approval ones.
create type listing_status as enum ('draft', 'active', 'sold', 'ended', 'archived', 'removed');

create table public.profiles (id uuid primary key, is_admin boolean default false);
create table public.platform_settings (key text primary key, value jsonb);
create table public.listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references public.profiles(id),
  status listing_status not null default 'active',
  price_aud numeric
);
