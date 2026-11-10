-- Minimal stand-in for the production tables touched by
-- 20261110203544_close_direct_write_gaps.sql (policies as they were in
-- production on 2026-11-10).
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create type trade_status as enum ('proposed', 'countered', 'accepted', 'fee_paid', 'completed', 'cancelled', 'disputed');
create table public.profiles (id uuid primary key, is_admin boolean not null default false);
create table public.orders (id uuid primary key, buyer_id uuid);
create table public.refunds (id uuid primary key default gen_random_uuid(), order_id uuid, buyer_id uuid, requested_by uuid, status text default 'pending', refund_amount_aud numeric default 0);
create table public.seller_ratings (id uuid primary key default gen_random_uuid(), seller_id uuid, reviewer_id uuid, order_id uuid, rating int);
create table public.vault_items (id uuid primary key default gen_random_uuid(), owner_id uuid, card_name text, is_featured boolean default false);
create table public.listings (id uuid primary key default gen_random_uuid(), seller_id uuid, vault_item_id uuid, status text default 'active', price_aud numeric);
create table public.trades (id uuid primary key default gen_random_uuid(), initiator_id uuid, responder_id uuid, status trade_status default 'proposed');

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.refunds enable row level security;
alter table public.seller_ratings enable row level security;
alter table public.vault_items enable row level security;
alter table public.listings enable row level security;
alter table public.trades enable row level security;

create policy p on public.profiles for select using (true);
create policy o on public.orders for select using (buyer_id = (select auth.uid()));
create policy "buyers can insert refund requests" on public.refunds for insert
  with check (buyer_id = (select auth.uid()) and requested_by = (select auth.uid())
    and exists (select 1 from public.orders o where o.id = refunds.order_id and o.buyer_id = (select auth.uid())));
create policy "Authenticated users can create ratings" on public.seller_ratings for insert with check ((select auth.uid()) = reviewer_id);
create policy "Users can insert into their own vault" on public.vault_items for insert with check ((select auth.uid()) = owner_id);
-- Owners only: another member's private card is invisible to the caller.
create policy v on public.vault_items for select using ((select auth.uid()) = owner_id);
create policy "Sellers can insert listings" on public.listings for insert with check ((select auth.uid()) = seller_id);
create policy l on public.listings for select using (true);
create policy listings_update_access on public.listings for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin) or (select auth.uid()) = seller_id)
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin) or (select auth.uid()) = seller_id);
create policy "Authenticated users can propose trades" on public.trades for insert with check ((select auth.uid()) = initiator_id);
create policy t on public.trades for select using ((select auth.uid()) in (initiator_id, responder_id));
create policy "Participants can update trade status" on public.trades for update
  using ((select auth.uid()) = responder_id or (select auth.uid()) = initiator_id);

grant select, insert, update on all tables in schema public to authenticated;
