-- Minimal stand-in for the Supabase pieces 20261110224209_event_organiser_requests.sql
-- touches. Used by tests/db/run-event-organiser-requests-migration.sh only.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;

create type notification_type as enum ('system');
create table public.profiles (id uuid primary key references auth.users(id), is_admin boolean default false);
grant select on public.profiles to authenticated;

-- The directory migration backfills organisers from events.
create table public.events (organizer_name text, organizer_logo_url text, created_at timestamptz default now());
