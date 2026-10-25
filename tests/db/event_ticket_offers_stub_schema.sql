-- Minimal stand-in for the parts of the Supabase schema the event ticket
-- offers migration touches. Used by tests/db/run-event-ticket-offer-migration.sh only.
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;

create type event_status as enum ('pending_review', 'approved', 'rejected', 'cancelled', 'completed');

create table public.profiles (id uuid primary key, is_admin boolean default false);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text, status event_status not null default 'pending_review',
  start_date date, end_date date, ticket_url text
);
grant select on public.profiles, public.events to authenticated, anon;
