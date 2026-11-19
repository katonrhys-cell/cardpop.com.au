-- Minimal stand-in for the production objects touched by
-- 20261119050236_close_private_data_gaps.sql, as they were on 2026-11-19.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create type event_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'completed');
create type order_status as enum ('pending', 'payment_confirmed', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed', 'payment_failed', 'completed');
create type trade_status as enum ('proposed', 'countered', 'accepted', 'fee_paid', 'completed', 'cancelled', 'disputed');
create type listing_status as enum ('active', 'sold', 'cancelled', 'pending');

create table public.profiles (id uuid primary key, display_name text, username text, is_admin boolean not null default false);
create table public.events (
  id uuid primary key default gen_random_uuid(), title text, slug text, status event_status default 'approved',
  organizer_name text, organizer_email text, organizer_phone text, organiser_id uuid, source_url text
);
create table public.orders (
  id uuid primary key, buyer_id uuid, seller_id uuid, status order_status default 'pending',
  shipping_name text, shipping_address text, shipping_suburb text, shipping_state text, shipping_postcode text,
  order_items jsonb
);
create table public.trades (id uuid primary key default gen_random_uuid(), initiator_id uuid, responder_id uuid, status trade_status default 'proposed');
create table public.vault_items (id uuid primary key default gen_random_uuid(), owner_id uuid, card_name text, publicly_listed boolean not null default false);
create table public.listings (id uuid primary key default gen_random_uuid(), seller_id uuid, vault_item_id uuid, status listing_status default 'active');

alter table public.events enable row level security;
alter table public.trades enable row level security;
alter table public.vault_items enable row level security;
alter table public.listings enable row level security;

-- The live policy references organiser_id, a column anon will lose: RLS quals
-- must keep working without a column grant.
create policy ev on public.events for select
  using (status in ('approved', 'completed') or organiser_id = (select auth.uid()));
create view public.events_public with (security_invoker = on) as
  select id, title, slug, status, organizer_name from public.events where status in ('approved', 'completed');

create policy tp on public.trades for insert with check ((select auth.uid()) = initiator_id);
create policy ts on public.trades for select using ((select auth.uid()) in (initiator_id, responder_id));
create policy tu on public.trades for update
  using ((select auth.uid()) in (initiator_id, responder_id))
  with check ((select auth.uid()) in (initiator_id, responder_id) and status not in ('accepted', 'fee_paid', 'completed'));

create policy vi on public.vault_items for insert with check ((select auth.uid()) = owner_id);
create policy vs on public.vault_items for select using (publicly_listed or (select auth.uid()) = owner_id);
create policy vu on public.vault_items for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy li on public.listings for insert with check ((select auth.uid()) = seller_id);
create policy ls on public.listings for select using (true);

-- The live listings → vault sync (20261010020701), verbatim in effect.
create function public.vault_item_refresh_publicly_listed(p_vault_item_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.vault_items vi set publicly_listed = l.listed
    from (select exists (select 1 from public.listings where listings.vault_item_id = p_vault_item_id
           and listings.status in ('active'::listing_status, 'sold'::listing_status)) as listed) l
   where vi.id = p_vault_item_id and vi.publicly_listed is distinct from l.listed;
$$;
create function public.trg_fn_listings_sync_publicly_listed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.vault_item_id is not null then
    perform public.vault_item_refresh_publicly_listed(new.vault_item_id);
  end if;
  return null;
end; $$;
create trigger trg_listings_sync_publicly_listed after insert or update of status, vault_item_id on public.listings
  for each row execute function public.trg_fn_listings_sync_publicly_listed();

grant select on all tables in schema public to anon;
grant select, insert, update on all tables in schema public to authenticated;
