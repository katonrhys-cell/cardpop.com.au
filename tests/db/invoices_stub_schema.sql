-- Minimal stand-ins for the tables the order-invoices migration references.
-- Used by tests/db/run-invoices-migration.sh only.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type public.order_status as enum (
  'pending', 'payment_confirmed', 'shipped', 'delivered', 'completed',
  'cancelled', 'payment_failed', 'refunded', 'disputed'
);

create table public.profiles (
  id uuid primary key,
  display_name text,
  email text,
  is_admin boolean not null default false
);

create table public.vault_items (id uuid primary key default gen_random_uuid(), card_name text);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  vault_item_id uuid references public.vault_items(id),
  seller_id uuid
);

create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  buyer_id                 uuid,
  buyer_email              text,
  seller_id                uuid,
  listing_id               uuid,
  stripe_session_id        text,
  stripe_payment_intent_id text,
  status                   public.order_status not null default 'pending',
  total_aud                numeric not null default 0,
  item_price_aud           numeric not null default 0,
  shipping_aud             numeric not null default 0,
  discount_aud             numeric not null default 0,
  platform_fee_aud         numeric not null default 0,
  processing_fee_aud       numeric(10,2) not null default 0,
  gst_aud                  numeric not null default 0,
  gst_included_aud         numeric not null default 0,
  seller_gst_aud           numeric(10,2) not null default 0,
  platform_gst_aud         numeric(10,2) not null default 0,
  payment_wallet_type      text,
  billing_business_name    text,
  billing_abn              text,
  shipping_name            text,
  shipping_address         text,
  shipping_suburb          text,
  shipping_state           text,
  shipping_postcode        text,
  order_items              jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.refunds (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid references public.orders(id),
  status            text not null default 'pending',
  refund_amount_aud numeric,
  processed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create table public.platform_settings (
  key         text primary key,
  value       jsonb,
  label       text not null,
  description text,
  group_name  text,
  updated_at  timestamptz not null default now()
);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles to anon, authenticated;
