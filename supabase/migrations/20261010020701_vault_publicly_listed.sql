-- vault_items.publicly_listed: a maintained flag that replaces the correlated
-- EXISTS on listings in the public-read policies.
--
-- Why: `vault_items_select_access` (20260819214352) decided visibility with
--   exists (select 1 from listings where vault_item_id = vault_items.id
--           and status in ('active','sold'))
-- — a subquery Postgres runs once PER vault_items ROW, for every read by every
-- visitor, and `vault_images` carried two more permissive policies that
-- re-entered vault_items RLS the same way. Every marketplace card embeds its
-- vault_item and vault_images, so a 24-card page nested these per image, and
-- the homepage's unfiltered count of vault_items evaluated it for every row
-- (EFFICIENCY_AUDIT_2026-10-10.md §5.2). Cheap at 36 cards; the first thing to
-- hurt at 36,000.
--
-- The flag means exactly what the EXISTS meant — "this card has an active or
-- sold listing" — and is kept current by a trigger on listings, so the policies
-- collapse to a column test. Semantics are unchanged: a card is publicly
-- readable when it is listed (active or sold), admin-featured, or yours; its
-- images follow the card.

-- ── 1. The column ──────────────────────────────────────────────────────────────
alter table public.vault_items
  add column if not exists publicly_listed boolean not null default false;

comment on column public.vault_items.publicly_listed is
  'True while the card has an active or sold listing. Maintained by trg_listings_sync_publicly_listed; read by the public SELECT policies. Never set it by hand.';

-- ── 2. Keeping it current ──────────────────────────────────────────────────────
-- Recompute one card's flag from its listings. Writes only when the value
-- changes, so no vault_items trigger (lock, floor, updated_at, realtime) fires
-- for a no-op.
create or replace function public.vault_item_refresh_publicly_listed(p_vault_item_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.vault_items vi
     set publicly_listed = l.listed
    from (
      select exists (
        select 1 from public.listings
         where listings.vault_item_id = p_vault_item_id
           and listings.status in ('active'::listing_status, 'sold'::listing_status)
      ) as listed
    ) l
   where vi.id = p_vault_item_id
     and vi.publicly_listed is distinct from l.listed;
$$;
revoke execute on function public.vault_item_refresh_publicly_listed(uuid) from public;
revoke execute on function public.vault_item_refresh_publicly_listed(uuid) from anon;
revoke execute on function public.vault_item_refresh_publicly_listed(uuid) from authenticated;

create or replace function public.trg_fn_listings_sync_publicly_listed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A listing moved to another card, or was deleted: the old card may have
  -- lost its last public listing.
  if tg_op in ('UPDATE', 'DELETE') and old.vault_item_id is not null
     and (tg_op = 'DELETE' or old.vault_item_id is distinct from new.vault_item_id) then
    perform public.vault_item_refresh_publicly_listed(old.vault_item_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.vault_item_id is not null then
    perform public.vault_item_refresh_publicly_listed(new.vault_item_id);
  end if;
  return null;
end;
$$;
revoke execute on function public.trg_fn_listings_sync_publicly_listed() from public;
revoke execute on function public.trg_fn_listings_sync_publicly_listed() from anon;
revoke execute on function public.trg_fn_listings_sync_publicly_listed() from authenticated;

drop trigger if exists trg_listings_sync_publicly_listed on public.listings;
create trigger trg_listings_sync_publicly_listed
  after insert or delete or update of status, vault_item_id on public.listings
  for each row execute function public.trg_fn_listings_sync_publicly_listed();

-- Backfill from the listings that exist today.
update public.vault_items vi
   set publicly_listed = true
 where not vi.publicly_listed
   and exists (
     select 1 from public.listings l
      where l.vault_item_id = vi.id
        and l.status in ('active'::listing_status, 'sold'::listing_status)
   );

-- ── 3. The lock trigger must let the system column through ───────────────────
-- trg_fn_vault_enforce_item_lock (20260823060200) rejects ANY update to a
-- locked card by a non-admin, including the one the trigger above performs
-- when the seller's listing sells. Treat publicly_listed like updated_at: a
-- system-maintained column that is never a "change" to the card. Everything
-- else is as before — while locked, no other column may move; an unlock must
-- be a pure toggle.
create or replace function public.trg_fn_vault_enforce_item_lock()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_changed  BOOLEAN;
BEGIN
  IF OLD.locked THEN
    SELECT COALESCE(is_admin, FALSE)
    INTO   v_is_admin
    FROM   profiles
    WHERE  id = auth.uid();

    IF NOT v_is_admin THEN
      -- jsonb diff avoids enumerating ~90 columns and automatically covers any
      -- column added later. `locked` itself may flip (an unlock); `updated_at`
      -- and `publicly_listed` are written by triggers, not by the user.
      v_changed := (to_jsonb(NEW) - 'locked' - 'updated_at' - 'publicly_listed')
                   IS DISTINCT FROM
                   (to_jsonb(OLD) - 'locked' - 'updated_at' - 'publicly_listed');
      IF v_changed THEN
        RAISE EXCEPTION 'This card is locked. Unlock it before making changes.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. The policies ────────────────────────────────────────────────────────────
-- One permissive SELECT policy on vault_items instead of two, and a column test
-- instead of a per-row subquery.
drop policy if exists "vault_items_public_featured_select" on public.vault_items;
drop policy if exists "vault_items_select_access" on public.vault_items;
create policy "vault_items_select_access" on public.vault_items
  as permissive for select to public
  using (
    publicly_listed
    or is_featured
    or (select auth.uid()) = owner_id
  );

-- vault_images: one public SELECT policy — the parent card's visibility — via a
-- primary-key lookup. (Owners keep "Users can manage images for their own
-- vault items".) The subquery is evaluated under vault_items' own RLS for the
-- reader, which is the same rule, so the two can never disagree.
drop policy if exists "vault_images_public_featured_select" on public.vault_images;
drop policy if exists "vault_images_public_listing_select" on public.vault_images;
drop policy if exists "vault_images_public_select" on public.vault_images;
create policy "vault_images_public_select" on public.vault_images
  as permissive for select to public
  using (
    exists (
      select 1 from public.vault_items vi
       where vi.id = vault_images.vault_item_id
         and (vi.publicly_listed or vi.is_featured)
    )
  );
