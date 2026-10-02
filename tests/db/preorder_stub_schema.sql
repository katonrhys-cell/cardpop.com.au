-- Minimal stand-in for the shop tables the pre-order migration touches: the
-- shop_products columns it constrains, the variants table whose read policy it
-- replaces, and the coming-soon status/policy it widens. Used by
-- tests/db/run-preorder-migration.sh only.
create extension if not exists "uuid-ossp";
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create table public.profiles (id uuid primary key, is_admin boolean default false);
create table public.shop_products (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  brand text,
  price_aud numeric not null default 0,
  updated_at timestamptz default now(),
  stock_quantity integer,
  status text not null default 'active' check (status in ('active','draft','archived'))
);
alter table public.shop_products enable row level security;
create table public.shop_product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.shop_products(id),
  colour text,
  status text not null default 'active'
);
alter table public.shop_product_variants enable row level security;
grant select, insert, update on public.shop_products, public.shop_product_variants to anon, authenticated;
grant select on public.profiles to anon, authenticated;
