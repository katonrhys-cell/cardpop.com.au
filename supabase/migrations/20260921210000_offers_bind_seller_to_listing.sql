-- Bind offers.seller_id to the listing's real owner.
--
-- offers.seller_id was written verbatim from the client (both the /offers route
-- and any direct PostgREST insert), and the INSERT policies only checked that
-- buyer_id = auth.uid() and that the listing was active. Nothing tied the
-- offer's seller to the listing's seller, so an attacker could file an offer on
-- a stranger's active listing naming an accomplice account as the seller, have
-- the accomplice "accept" it (offers_update_access lets the row's seller_id
-- accept), and then check out the victim's card at a self-chosen price — the
-- checkout only required an accepted offer. The same gap let anyone push a
-- forged "offer received" notification + email to any user.
--
-- Two layers, both idempotent:
--   1. A BEFORE INSERT trigger that overwrites seller_id with the listing's
--      seller (and rejects an offer on a missing listing). Applies to every
--      role, including service_role.
--   2. A restrictive INSERT policy so a direct client insert that names the
--      wrong seller fails RLS with a clear error rather than being silently
--      corrected.
-- The application (src/routes/offers.js, checkoutService.resolveOfferPrice)
-- also derives/checks the seller server-side.

create or replace function public.offers_set_seller_from_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
begin
  select l.seller_id into v_seller from public.listings l where l.id = new.listing_id;
  if v_seller is null then
    raise exception 'Offer refers to an unknown listing' using errcode = '23503';
  end if;
  if new.buyer_id = v_seller then
    raise exception 'You cannot make an offer on your own listing' using errcode = '23514';
  end if;
  new.seller_id := v_seller;
  return new;
end;
$$;

revoke execute on function public.offers_set_seller_from_listing() from public, anon, authenticated;

drop trigger if exists offers_set_seller_from_listing on public.offers;
create trigger offers_set_seller_from_listing
  before insert on public.offers
  for each row execute function public.offers_set_seller_from_listing();

drop policy if exists offers_seller_must_own_listing on public.offers;
create policy offers_seller_must_own_listing
  on public.offers
  as restrictive
  for insert
  to authenticated
  with check (
    seller_id = (select l.seller_id from public.listings l where l.id = offers.listing_id)
  );
