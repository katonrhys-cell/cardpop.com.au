-- Site bug audit, 2026-11-19: four database gaps found by reading the live
-- grants and policies. Each section is idempotent and independent.
--
-- 1. events: anonymous visitors could read the organiser's private contact
--    details straight off the base table.
-- 2. seller_sale_shipping(): a seller could read the delivery address of an
--    order that was never paid.
-- 3. trades: a member could insert a trade that was born accepted, or wind an
--    accepted trade back to proposed.
-- 4. vault_items.publicly_listed: an owner could make an unlisted card public
--    by setting the "database-owned" flag themselves.
--
-- Test: tests/db/run-private-data-gaps-migration.sh

-- ── 1. events: private columns are not anonymous-readable ────────────────────
-- events_public (security_invoker) and the prerender read the base table with
-- the anon role, so anon keeps SELECT on every column EXCEPT these four, which
-- no public surface shows. 12 approved events exposed a member's personal email
-- and phone through `GET /rest/v1/events?select=organizer_email,organizer_phone`.
-- Signed-in members keep the table-level grant: organisers and admins edit
-- through `select('*')`, and the rows they can see are limited by RLS.
--
-- A column grant is per column, so a column added later is NOT readable by anon
-- until it is granted: a migration that adds a public column to events must end
-- with `select private.grant_events_anon_select();`
-- (tests/backend/eventsAnonColumnGrant.test.js enforces it).
create schema if not exists private;

create or replace function private.events_private_columns()
returns text[]
language sql
immutable
as $$
  select array['organizer_email', 'organizer_phone', 'organiser_id', 'source_url']::text[]
$$;

create or replace function private.grant_events_anon_select()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'events'
     and c.column_name <> all (private.events_private_columns());
  revoke select on public.events from anon;
  execute format('grant select (%s) on public.events to anon', v_cols);
end;
$$;
revoke all on function private.grant_events_anon_select() from public;

select private.grant_events_anon_select();

-- ── 2. seller_sale_shipping(): paid orders only ──────────────────────────────
-- The cart checkout writes the order, with the shipping address, as `pending`
-- before payment. A seller whose card was in an abandoned, failed or cancelled
-- checkout could read that buyer's name and street address. A seller only
-- needs it once there is something to post.
create or replace function public.seller_sale_shipping(p_order_id uuid)
returns table (
  order_id uuid,
  shipping_name text,
  shipping_address text,
  shipping_suburb text,
  shipping_state text,
  shipping_postcode text,
  buyer_name text,
  item_titles text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.shipping_name,
    o.shipping_address,
    o.shipping_suburb,
    o.shipping_state,
    o.shipping_postcode,
    coalesce(p.display_name, p.username, o.shipping_name),
    -- Only this seller's lines, so a cart seller doesn't learn what else was bought.
    coalesce(
      (select array_agg(l ->> 'title')
         from jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
        where l ->> 'seller_id' = (select auth.uid())::text),
      array[]::text[]
    )
  from orders o
  left join profiles p on p.id = o.buyer_id
  where o.id = p_order_id
    and o.status::text in ('payment_confirmed', 'shipped', 'delivered', 'completed', 'disputed')
    and (
      o.seller_id = (select auth.uid())
      or exists (
        select 1 from jsonb_array_elements(coalesce(o.order_items::jsonb, '[]'::jsonb)) l
        where l ->> 'seller_id' = (select auth.uid())::text
      )
    );
$$;

-- ── 3. trades: lifecycle belongs to accept_trade() and the server ────────────
-- 20261110203544 stopped a direct UPDATE *to* accepted / fee_paid / completed,
-- but the INSERT policy only checks the initiator, so a trade could be inserted
-- already accepted, and an accepted trade could be updated back to proposed.
create or replace function public.trades_guard_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- The service role and accept_trade()'s own writes run without a member id
  -- on the row they change; a signed-in caller is held to the rules.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'proposed';
    return new;
  end if;
  if old.status::text in ('accepted', 'fee_paid', 'completed')
     and new.status::text in ('proposed', 'countered') then
    raise exception 'An accepted trade cannot be reopened'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.trades_guard_lifecycle() from public, anon, authenticated;

drop trigger if exists trg_trades_guard_lifecycle on public.trades;
create trigger trg_trades_guard_lifecycle
  before insert or update of status on public.trades
  for each row execute function public.trades_guard_lifecycle();

-- ── 4. vault_items.publicly_listed: derived, never chosen ────────────────────
-- The flag is true while the card has an active or sold listing, and the public
-- SELECT policies on vault_items / vault_images read it. Nothing stopped the
-- owner setting it themselves, which published an unlisted card and its photos
-- without a listing (or the can_sell() entitlement and listing moderation that
-- come with one). Whenever a signed-in write tries to change it, it is
-- recomputed from listings — the same rule vault_item_refresh_publicly_listed()
-- applies from the AFTER trigger on listings, so that path is unaffected.
create or replace function public.vault_items_derive_publicly_listed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.publicly_listed is not distinct from old.publicly_listed then
    return new;
  end if;
  new.publicly_listed := exists (
    select 1 from public.listings l
     where l.vault_item_id = new.id
       and l.status::text in ('active', 'sold')
  );
  return new;
end;
$$;
revoke all on function public.vault_items_derive_publicly_listed() from public, anon, authenticated;

drop trigger if exists trg_vault_items_derive_publicly_listed on public.vault_items;
create trigger trg_vault_items_derive_publicly_listed
  before insert or update of publicly_listed on public.vault_items
  for each row execute function public.vault_items_derive_publicly_listed();
