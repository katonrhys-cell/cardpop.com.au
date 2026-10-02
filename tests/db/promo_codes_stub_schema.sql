-- Minimal stand-ins for the tables the promo-code migration references.
-- Used by tests/db/run-promo-code-migrations.sh only.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (id uuid primary key, is_admin boolean default false);
create table public.orders (id uuid primary key default gen_random_uuid());
create table public.partners (id uuid primary key default gen_random_uuid(), code text);
