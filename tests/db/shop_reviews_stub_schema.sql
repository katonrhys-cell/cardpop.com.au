-- Minimal stand-in for the parts of the Supabase schema the shop-review
-- migration touches. Used by tests/db/run-shop-review-migrations.sh only.
create extension if not exists "uuid-ossp";
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create type notification_type as enum ('offer_received', 'system');
create type order_status as enum ('pending', 'payment_confirmed', 'shipped', 'completed', 'refunded', 'cancelled');

create table public.profiles (id uuid primary key, display_name text, username text, is_admin boolean default false);
create table public.shop_products (id uuid primary key default gen_random_uuid(), title text, family_sku text, status text default 'active');
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid,
  status order_status not null default 'pending',
  order_items jsonb
);
create table public.notifications (
  id bigserial primary key, user_id uuid, type notification_type, title text, body text, link text, related_id uuid
);
create or replace function public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_body text, p_link text default null, p_related_id uuid default null)
returns void language sql security definer as
$$ insert into public.notifications (user_id, type, title, body, link, related_id) values (p_user_id, p_type, p_title, p_body, p_link, p_related_id) $$;

grant select on public.profiles, public.shop_products, public.orders to authenticated, anon;
