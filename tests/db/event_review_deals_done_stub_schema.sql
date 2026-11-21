-- Minimal stand-in for production as it stood before
-- 20261119092859_event_review_deals_done.sql: only what the event_reviews
-- migrations and the deals-done test touch.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, allowed_mime_types text[]);

create table public.profiles (id uuid primary key default gen_random_uuid(), is_admin boolean not null default false);
create table public.events (id uuid primary key default gen_random_uuid(), title text);
create table public.blog_articles (id uuid primary key default gen_random_uuid(), title text, is_published boolean not null default false);
grant select on public.profiles, public.blog_articles to anon, authenticated;
