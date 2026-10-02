-- Close the listing-approval bypass on UPDATE.
--
-- 20260709084111_enforce_listing_approval.sql gates only INSERTs: a brand-new
-- 'active' listing is forced to 'pending' while the `listing_approval_required`
-- platform setting is on. But a seller could then flip their own held row
-- straight to 'active' with an UPDATE (and vaultListingService used to do
-- exactly that on every card edit, since it re-upserts status 'active' into
-- the existing listing row) — so a pending listing went live without review.
--
-- This migration extends the same function to UPDATE OF status. On update it
-- only intervenes when:
--   * the row is moving INTO 'active' from a status that wasn't 'active'
--     (editing an already-live listing is untouched), and
--   * the caller is a signed-in non-admin (admins approve pending listings by
--     setting status 'active' from Admin -> Listings; service-role / backend
--     writes have no auth.uid() and are trusted, as is the Stripe webhook —
--     which only ever writes 'sold' anyway), and
--   * approval is required by the same platform setting the insert path reads.
-- In that case the status is forced back to 'pending'.
--
-- The INSERT behaviour is unchanged. Idempotent: create or replace + drop
-- trigger if exists. The function's existing EXECUTE revokes
-- (20260715260000 / 20260715270000) are preserved by create or replace.

create or replace function public.enforce_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approval_required boolean;
  caller uuid;
begin
  -- Only gate listings that would otherwise go live immediately.
  if new.status is distinct from 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- An already-live listing being edited stays live.
    if old.status = 'active' then
      return new;
    end if;

    caller := auth.uid();
    -- Service-role / backend writes carry no end-user identity.
    if caller is null then
      return new;
    end if;

    -- Admins publish pending listings by moving them to 'active'.
    if exists (
      select 1 from public.profiles p
       where p.id = caller and coalesce(p.is_admin, false)
    ) then
      return new;
    end if;
  end if;

  select coalesce(value = 'true'::jsonb or value = '"true"'::jsonb, false)
    into approval_required
    from public.platform_settings
   where key = 'listing_approval_required';

  if approval_required then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_listing_approval on public.listings;
create trigger trg_enforce_listing_approval
  before insert on public.listings
  for each row
  execute function public.enforce_listing_approval();

drop trigger if exists trg_enforce_listing_approval_update on public.listings;
create trigger trg_enforce_listing_approval_update
  before update of status on public.listings
  for each row
  execute function public.enforce_listing_approval();
