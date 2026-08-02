-- Monthly listing quota, enforced at the database layer.
--
-- Every membership tier gets a fixed number of NEW marketplace listings per
-- calendar month (config/plans.js LISTINGS_PER_MONTH is the app-side mirror
-- of this table — keep the two in sync):
--
--   free (Hobby) →  5      pro → 15      premium → 30
--   elite        → 50      ultimate → unlimited
--
-- Marketplace listings are created both by the /vault/items backend route
-- (caller-scoped client) and by direct client-side inserts
-- (components/VaultListingModal.jsx), so — exactly like the
-- enforce_listing_approval trigger this is modelled on — a BEFORE INSERT
-- trigger is the only place the limit can be enforced for real. A trigger
-- also binds service-role writes, which RLS would not.
--
-- Only INSERTs consume quota: re-listing an existing card updates its listings
-- row (vaultListingService reuses any non-archived row), so flipping a card
-- private/public or editing a listing never double-counts. The count includes
-- every row created this month regardless of its current status, so deleting
-- or archiving a listing does not refund the month's allowance.
--
-- Admin accounts are exempt (moderation tooling may insert on a seller's
-- behalf).
--
-- SECURITY DEFINER: the seller's subscription_tier must be read regardless of
-- the inserting user's RLS on profiles, otherwise enforcement could silently
-- fail open. search_path is pinned per the function-hardening baseline.
--
-- The error message carries the LISTING_QUOTA_EXCEEDED marker that
-- utils/listingErrors.js matches to show the seller a friendly upgrade prompt
-- instead of a raw Postgres error.

create or replace function public.enforce_monthly_listing_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_tier text;
  seller_is_admin boolean;
  quota integer;
  used integer;
begin
  select coalesce(p.subscription_tier, 'free'), coalesce(p.is_admin, false)
    into seller_tier, seller_is_admin
    from public.profiles p
   where p.id = new.seller_id;

  if seller_is_admin then
    return new;
  end if;

  quota := case seller_tier
    when 'pro'      then 15
    when 'premium'  then 30
    when 'elite'    then 50
    when 'ultimate' then null   -- unlimited
    else 5                      -- 'free' (Hobby) and anything unknown
  end;

  if quota is null then
    return new;
  end if;

  select count(*)::integer
    into used
    from public.listings l
   where l.seller_id = new.seller_id
     and l.created_at >= date_trunc('month', now());

  if used >= quota then
    raise exception 'LISTING_QUOTA_EXCEEDED: your plan allows % new listings per calendar month and you have used %. Upgrade your membership to list more this month.', quota, used
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_monthly_listing_quota() from public, anon;

drop trigger if exists trg_enforce_monthly_listing_quota on public.listings;
create trigger trg_enforce_monthly_listing_quota
  before insert on public.listings
  for each row
  execute function public.enforce_monthly_listing_quota();
