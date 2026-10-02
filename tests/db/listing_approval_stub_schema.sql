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

create type listing_status as enum ('draft', 'active', 'sold', 'ended', 'archived', 'removed', 'pending', 'private');

create table public.profiles (id uuid primary key, is_admin boolean default false);
create table public.platform_settings (key text primary key, value jsonb);
create table public.listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references public.profiles(id),
  status listing_status not null default 'active',
  price_aud numeric
);
