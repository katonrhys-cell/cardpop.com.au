-- Minimal stand-in for every table 20261010020702_browse_indexes_and_trigger_scope.sql
-- touches, with the production indexes it drops, so the migration can be
-- applied (twice) to a throwaway database. Used by
-- tests/db/run-browse-indexes-migration.sh only.
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

create type listing_status as enum ('draft', 'active', 'sold', 'ended', 'archived', 'removed');
create type order_status as enum ('pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded');

create table public.profiles (
  id uuid primary key default uuid_generate_v4(),
  is_admin boolean default false,
  is_active boolean default true,
  is_featured_seller boolean default false,
  subscription_tier text default 'free',
  rating numeric
);
create index idx_profiles_featured_sellers on public.profiles (id) where is_featured_seller = true and is_active = true;

create table public.vault_items (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id),
  card_name text, card_number text, variant text,
  is_public boolean default false, is_featured boolean default false,
  estimated_value_aud numeric,
  created_at timestamptz default now()
);
create index vault_items_owner_id_idx on public.vault_items (owner_id);
create index idx_vault_items_card_name_trgm on public.vault_items using gin (card_name gin_trgm_ops);
create index vault_items_card_name_idx on public.vault_items using gin (card_name gin_trgm_ops);
create index vault_items_is_featured_idx on public.vault_items (is_featured) where is_featured = true;
create index idx_vault_items_featured_created on public.vault_items (created_at desc) where is_featured = true;

create table public.listings (
  id uuid primary key default uuid_generate_v4(),
  vault_item_id uuid references public.vault_items(id),
  seller_id uuid references public.profiles(id),
  status listing_status not null default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index listings_seller_id_idx on public.listings (seller_id);
create index listings_vault_item_id_idx on public.listings (vault_item_id);
create index listings_status_idx on public.listings (status);
create index idx_listings_status_created on public.listings (status, created_at desc);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, type text, related_id uuid, created_at timestamptz default now()
);

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid, seller_id uuid, buyer_email text, stripe_payment_intent_id text,
  status order_status default 'pending', created_at timestamptz default now()
);
create index orders_buyer_id_idx on public.orders (buyer_id);
create index orders_seller_id_idx on public.orders (seller_id);

create table public.trades (
  id uuid primary key default uuid_generate_v4(),
  initiator_id uuid, responder_id uuid, status text
);
create index trades_initiator_id_idx on public.trades (initiator_id);
create index idx_trades_responder_status on public.trades (responder_id, status);

create table public.events (
  id uuid primary key default uuid_generate_v4(),
  status text, start_date date, suburb text, title text
);

create table public.card_catalogue (id uuid primary key default uuid_generate_v4(), card_name text);
create table public.whatnot_shows (id uuid primary key default uuid_generate_v4(), user_id uuid);
create index idx_whatnot_shows_user_id on public.whatnot_shows (user_id);
create index whatnot_shows_user_id_idx on public.whatnot_shows (user_id);
create table public.card_price_snapshots (id uuid primary key default uuid_generate_v4(), card_id uuid, snapshot_date date, unique (card_id, snapshot_date));
create index card_price_snapshots_card_date_idx on public.card_price_snapshots (card_id, snapshot_date desc);
create table public.saved_searches (id uuid primary key default uuid_generate_v4(), user_id uuid, params jsonb, unique (user_id, params));
create index saved_searches_user_id_idx on public.saved_searches (user_id);
create table public.shop_products (id uuid primary key default uuid_generate_v4(), status text, created_at timestamptz default now(), price_aud numeric);
create index idx_shop_products_status on public.shop_products (status);
create index idx_shop_products_status_created_at_id on public.shop_products (status, created_at desc, id);

-- The points trigger as it stands in production (20260823060000): fires on
-- EVERY update; the migration narrows it to `of status`.
create table public.points_log (user_id uuid, points int, reason text, ref uuid);
create or replace function public.award_points(p_user uuid, p_points int, p_reason text, p_ref uuid)
returns void language sql as $$ insert into public.points_log values (p_user, p_points, p_reason, p_ref) $$;
create or replace function public.award_points_on_order_completed() returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform award_points(new.seller_id, 25, 'sale_completed', new.id);
    perform award_points(new.buyer_id, 15, 'purchase_completed', new.id);
  end if;
  return new;
end $$;
create trigger award_points_on_order_completed after update on public.orders
  for each row execute function public.award_points_on_order_completed();
