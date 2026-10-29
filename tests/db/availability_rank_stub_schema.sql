-- Minimal stand-in for shop_products as the availability_rank migration finds
-- it: the status values the storefront knows and a non-null stock count. Used
-- by tests/db/run-availability-rank-migration.sh only.
create extension if not exists "uuid-ossp";
create table public.shop_products (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  price_aud numeric not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status text not null default 'active'
    check (status in ('active','draft','archived','coming_soon','preorder')),
  created_at timestamptz not null default now()
);
