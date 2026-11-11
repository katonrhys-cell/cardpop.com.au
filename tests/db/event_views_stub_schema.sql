-- Stand-in for the Supabase pieces the event-views migration touches.
-- Used by tests/db/run-event-views-migration.sh only.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;

create type event_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'cancelled', 'completed');
create table public.profiles (id uuid primary key, is_admin boolean default false);
grant select on public.profiles to authenticated;
create table public.events (id uuid primary key default gen_random_uuid(), organiser_id uuid, status event_status not null default 'pending_review');
grant select on public.events to authenticated;
