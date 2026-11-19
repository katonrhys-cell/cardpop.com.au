-- Minimal stand-in for what the video-creators migration finds: the roles,
-- auth.uid(), profiles.is_admin, and the two tables whose video JSON carries
-- creator credits. Used by tests/db/run-video-creators-migration.sh only.
create schema if not exists auth;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;

create table public.profiles (id uuid primary key, is_admin boolean not null default false);
grant select on public.profiles to anon, authenticated;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_videos jsonb not null default '[]'::jsonb
);
create table public.event_organisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  videos jsonb not null default '[]'::jsonb
);
