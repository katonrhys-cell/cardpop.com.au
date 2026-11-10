-- Close five direct-write gaps found in the 2026-11-10 audit.
--
-- Each of these tables has an Express route that validates the write and then
-- performs it — but the browser's own INSERT/UPDATE policy was left wide
-- enough to skip the route entirely with nothing but a signed-in session and
-- the public anon key. Verified against production's pg_policies / pg_trigger
-- on 2026-11-10; none had been abused (0 refunds, 0 seller ratings, no listing
-- pointing at another member's card).
--
-- Every statement is idempotent.

-- ── 1. refunds: no browser inserts ───────────────────────────────────────────
-- "buyers can insert refund requests" only checked that the buyer owned the
-- order, so a buyer could insert {status: 'approved'} (skipping the refund
-- window, the reason check and admin approval — the admin's Process click
-- would then pay it) or {status: 'processed', refund_amount_aud: 99999}
-- (corrupting the Finance and Revenue pages that read this table). The app
-- has not inserted from the browser since POST /refunds/request moved to the
-- service role (src/routes/refunds.js), so the policy has no legitimate user.
drop policy if exists "buyers can insert refund requests" on public.refunds;

-- ── 2. seller_ratings: no browser inserts ────────────────────────────────────
-- "Authenticated users can create ratings" checked only reviewer_id =
-- auth.uid(): anyone could post unlimited one-star reviews on any seller with
-- no order at all (order_id null never collides with the unique key), each one
-- public on the seller's page and worth 10 points to the author. The checks
-- that make a review real — a shipped order of the reviewer's from that seller,
-- one review per order — live in src/routes/seller-ratings.js, which writes
-- with the service role.
drop policy if exists "Authenticated users can create ratings" on public.seller_ratings;

-- ── 3. vault_items: a member can't feature their own card on insert ──────────
-- The UPDATE policy pins is_featured, but INSERT only checked owner_id, so
-- inserting a card with is_featured = true put arbitrary member images and
-- text into the homepage Featured strip (and the edge-cached /public/home),
-- readable by anonymous visitors through the is_featured branch of the SELECT
-- policy. Featuring is an admin action.
create or replace function public.vault_items_guard_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is not null
     and coalesce(new.is_featured, false)
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
    new.is_featured := false;
  end if;
  return new;
end;
$$;
revoke all on function public.vault_items_guard_insert() from public, anon, authenticated;

drop trigger if exists trg_vault_items_guard_insert on public.vault_items;
create trigger trg_vault_items_guard_insert
  before insert on public.vault_items
  for each row execute function public.vault_items_guard_insert();

-- ── 4. listings: a listing sells the seller's own card ───────────────────────
-- Nothing tied listings.vault_item_id to the seller. A seller could insert an
-- active listing pointing at another member's vault item: the
-- publicly_listed / estimated-value sync triggers (security definer) then
-- made the victim's private card and photos public, overwrote its estimated
-- value, and offered it for sale under the attacker's name.
create or replace function public.listings_require_own_vault_item()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- The service role is trusted; an untouched pairing on UPDATE is not
  -- re-checked (so an admin editing a listing's price is unaffected).
  if auth.uid() is null or new.vault_item_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.vault_item_id is not distinct from old.vault_item_id
     and new.seller_id is not distinct from old.seller_id then
    return new;
  end if;
  if not exists (
    select 1 from public.vault_items v
    where v.id = new.vault_item_id and v.owner_id = new.seller_id
  ) then
    raise exception 'listings: a listing can only sell a card from the seller''s own vault'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.listings_require_own_vault_item() from public, anon, authenticated;

drop trigger if exists trg_listings_require_own_vault_item on public.listings;
create trigger trg_listings_require_own_vault_item
  before insert or update on public.listings
  for each row execute function public.listings_require_own_vault_item();

-- ── 5. trades: acceptance only through accept_trade() ────────────────────────
-- "Participants can update trade status" had no WITH CHECK, so the initiator
-- could set their own proposal to 'accepted' — bypassing the accept_trade()
-- RPC (responder-only, and it cancels competing proposals in the same
-- transaction), notifying the other side of an acceptance they never gave and
-- farming the 15 points awarded per accepted trade. Direct updates may still
-- cancel/counter/dispute; accept_trade() is SECURITY DEFINER and is not bound
-- by this policy. 'fee_paid' and 'completed' are money states and were never
-- a browser's to set either.
drop policy if exists "Participants can update trade status" on public.trades;
create policy "Participants can update trade status" on public.trades
  for update to authenticated
  using ((select auth.uid()) = responder_id or (select auth.uid()) = initiator_id)
  with check (
    ((select auth.uid()) = responder_id or (select auth.uid()) = initiator_id)
    and status not in ('accepted', 'fee_paid', 'completed')
  );
