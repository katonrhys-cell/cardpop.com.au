-- Expression of Interest: an optional offer window, and an open-ended range.
--
-- 1. listings.offers_open_at / offers_close_at — an EOI seller can say when
--    they are taking offers ("offers open 1 Nov, close 14 Nov"). Both are
--    optional and independent: no open date = open now, no close date = open
--    until the seller takes the listing down. Outside the window the listing
--    stays visible but takes no offers.
-- 2. The range's upper bound (price_max_aud) is optional — "offers from $X"
--    with no ceiling. The column was always nullable; this only adds sanity
--    checks for the values a seller can now combine.
-- 3. The offers insert trigger refuses an offer on an EOI listing outside its
--    window, so the rule holds even for a direct browser insert that skips
--    POST /offers. Otherwise unchanged from
--    20260928071648_binding_offers_lifecycle.sql.

-- ── 1. Offer window ─────────────────────────────────────────────────────────

alter table public.listings
  add column if not exists offers_open_at timestamptz,
  add column if not exists offers_close_at timestamptz;

comment on column public.listings.offers_open_at is
  'Expression of Interest: when the listing starts taking offers. Null = open now.';
comment on column public.listings.offers_close_at is
  'Expression of Interest: when the listing stops taking offers. Null = no closing date.';

-- ── 2. Sanity checks ────────────────────────────────────────────────────────
-- NOT VALID: enforced on every new write without failing the migration over
-- any odd legacy row.

alter table public.listings drop constraint if exists listings_offer_window_order;
alter table public.listings
  add constraint listings_offer_window_order
  check (offers_open_at is null or offers_close_at is null or offers_close_at > offers_open_at)
  not valid;

alter table public.listings drop constraint if exists listings_eoi_range_order;
alter table public.listings
  add constraint listings_eoi_range_order
  check (price_min_aud is null or price_max_aud is null or price_max_aud >= price_min_aud)
  not valid;

-- ── 3. Offers refuse outside the window ─────────────────────────────────────

create or replace function public.offers_set_seller_from_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
begin
  select l.seller_id, l.listing_type::text as listing_type, l.accepts_offers,
         l.offers_open_at, l.offers_close_at
    into v_listing
    from public.listings l
   where l.id = new.listing_id;
  if v_listing.seller_id is null then
    raise exception 'Offer refers to an unknown listing' using errcode = '23503';
  end if;
  if new.buyer_id = v_listing.seller_id then
    raise exception 'You cannot make an offer on your own listing' using errcode = '23514';
  end if;
  if not (
    v_listing.listing_type = 'expression_of_interest'
    or (v_listing.listing_type = 'fixed' and coalesce(v_listing.accepts_offers, true))
  ) then
    raise exception 'This listing is not accepting offers' using errcode = '23514';
  end if;
  if v_listing.listing_type = 'expression_of_interest' then
    if v_listing.offers_open_at is not null and now() < v_listing.offers_open_at then
      raise exception 'This listing is not taking offers yet' using errcode = '23514';
    end if;
    if v_listing.offers_close_at is not null and now() >= v_listing.offers_close_at then
      raise exception 'Offers on this listing have closed' using errcode = '23514';
    end if;
  end if;
  if new.binding_acknowledged_at is null then
    raise exception 'Offers must be acknowledged as binding' using errcode = '23514';
  end if;

  new.seller_id := v_listing.seller_id;
  -- Lifecycle columns are never the buyer's to choose.
  new.status := 'pending';
  new.counter_amount_aud := null;
  new.counter_message := null;
  new.responded_at := null;
  new.created_at := now();
  new.expires_at := now() + interval '48 hours';
  new.binding_acknowledged_at := least(new.binding_acknowledged_at, now());
  return new;
end;
$$;

revoke execute on function public.offers_set_seller_from_listing() from public, anon, authenticated;

drop trigger if exists offers_set_seller_from_listing on public.offers;
create trigger offers_set_seller_from_listing
  before insert on public.offers
  for each row execute function public.offers_set_seller_from_listing();
