-- Minimal stand-in for the parts of the Supabase schema the offer migrations
-- touch, mirroring production (checked 2026-09-28): the offers columns, enum,
-- RLS policies, enum values and triggers that were applied from the dashboard before the
-- repo tracked them. Used by tests/db/run-offer-migrations.sh only.
create extension if not exists "uuid-ossp";
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create type listing_status as enum ('draft', 'active', 'sold', 'ended', 'archived', 'removed');
create type listing_type as enum ('fixed', 'auction', 'trade', 'vault', 'expression_of_interest');
create type offer_status as enum ('pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn');
create type notification_type as enum ('offer_received', 'offer_accepted', 'offer_declined', 'offer_countered', 'system');

create table public.profiles (id uuid primary key, email text, is_admin boolean default false);
create table public.vault_items (id uuid primary key default uuid_generate_v4(), card_name text);
create table public.listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references public.profiles(id),
  vault_item_id uuid references public.vault_items(id),
  listing_type listing_type not null default 'fixed',
  status listing_status not null default 'active',
  price_aud numeric,
  accepts_offers boolean not null default false
);
create table public.offers (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null,
  seller_id uuid not null,
  amount_aud numeric not null,
  message text,
  status offer_status not null default 'pending',
  counter_amount_aud numeric,
  counter_message text,
  expires_at timestamptz default (now() + '48:00:00'::interval),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.notifications (
  id bigserial primary key, user_id uuid, type notification_type, title text, body text, link text, related_id uuid
);
create or replace function public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_body text, p_link text default null, p_related_id uuid default null)
returns void language sql security definer as
$$ insert into public.notifications (user_id, type, title, body, link, related_id) values (p_user_id, p_type, p_title, p_body, p_link, p_related_id) $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger offers_updated_at before update on public.offers for each row execute function public.set_updated_at();

alter table public.offers enable row level security;
create policy "Buyers can create offers" on public.offers for insert with check ((select auth.uid()) = buyer_id);
create policy "Offers visible to buyer and seller" on public.offers for select using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);
create policy offers_update_access on public.offers for update
  using (((select auth.uid()) = buyer_id and status = 'countered') or ((select auth.uid()) = buyer_id and status = 'pending') or ((select auth.uid()) = seller_id and status = 'pending'))
  with check (((select auth.uid()) = buyer_id and status = any (array['accepted'::offer_status, 'declined'::offer_status])) or ((select auth.uid()) = buyer_id and status = 'withdrawn') or ((select auth.uid()) = seller_id and status = any (array['accepted'::offer_status, 'declined'::offer_status, 'countered'::offer_status])));
create policy offers_require_active_listing on public.offers for insert
  with check (exists (select 1 from public.listings where listings.id = offers.listing_id and listings.status = 'active'));
grant select, insert, update on public.offers to authenticated;
grant select on public.listings, public.profiles, public.vault_items to authenticated;
