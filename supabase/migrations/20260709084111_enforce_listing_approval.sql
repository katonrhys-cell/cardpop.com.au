-- Enforce the `listing_approval_required` platform setting at the database
-- layer. Marketplace listings are created by direct client-side inserts (there
-- is no server route), so a BEFORE INSERT trigger is the only place this can be
-- enforced for real — a crafted client cannot bypass it.
--
-- When the setting is on, a brand-new public ('active') listing is forced into
-- a 'pending' state until an admin approves it. Browse/marketplace queries
-- already filter to active/sold, so pending listings stay hidden from buyers
-- until approval. Other statuses (private, draft, archived, sold) are untouched.
--
-- SECURITY DEFINER: the setting must be read regardless of the inserting user's
-- RLS on platform_settings, otherwise a normal seller's insert couldn't see the
-- flag and enforcement would silently fail open. search_path is pinned per the
-- function-hardening baseline.

create or replace function public.enforce_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approval_required boolean;
begin
  -- Only gate listings that would otherwise go live immediately.
  if new.status is distinct from 'active' then
    return new;
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
