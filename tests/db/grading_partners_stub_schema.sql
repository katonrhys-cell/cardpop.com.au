-- Minimal stand-in for the parts of the Supabase schema the grading partners
-- migration touches. Used by tests/db/run-grading-partners-migration.sh only.
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table if not exists public.profiles (id uuid primary key, is_admin boolean default false);
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', true),
  ('00000000-0000-0000-0000-00000000000b', false)
on conflict (id) do nothing;
-- The RLS policies look up profiles.is_admin as the API roles; production grants this.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
