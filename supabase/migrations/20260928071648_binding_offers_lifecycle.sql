-- Binding offers: a 48-hour window the buyer is held to until they withdraw,
-- enforced in the database rather than only in the UI, plus admin visibility
-- of every offer.
--
-- 1. offers.binding_acknowledged_at — when the buyer ticked "I understand this
--    offer is binding". POST /offers sets it; the insert trigger refuses an
--    offer without it, so an offer can't exist that the buyer didn't agree to.
--
-- 2. BEFORE INSERT (offers_set_seller_from_listing, replaced): the server now
--    decides every lifecycle column on a new offer. Previously a buyer could
--    insert straight from the browser with status = 'accepted' (the INSERT
--    policy only checked buyer_id / listing / seller) and resolveOfferPrice
--    would price a checkout at that self-chosen amount — i.e. buy any card for
--    $1 with no seller consent. New offers are now always 'pending', with no
--    counter, and expire exactly 48 hours after creation. It also refuses
--    offers on listings that don't take them (trade-only, auctions, or a
--    fixed-price listing whose seller switched Accept Offers off).
--
-- 3. BEFORE UPDATE (offers_enforce_lifecycle, new): once expires_at passes, a
--    pending offer can no longer be accepted or countered, and a countered one
--    can no longer be accepted by the buyer. When the seller counters, the
--    buyer gets a fresh 48 hours to respond. Service-role writes (the Stripe
--    webhook marking a paid counter 'accepted') are exempt: the checkout
--    already checked expiry, and the webhook can land minutes later.
--
-- 4. expire_stale_offers() + a pg_cron job every 15 minutes flip overdue
--    pending/countered offers to 'expired' so both sides see the real state
--    (and get a notification) instead of an offer that looks live forever.
--
-- 5. Notifications: every new offer also notifies every admin account (the
--    bell); a withdrawn offer now tells the seller; an expired one tells both.
--    The admin email is sent by POST /offers (src/routes/offers.js).

-- ── 1. Binding acknowledgement ──────────────────────────────────────────────

alter table public.offers
  add column if not exists binding_acknowledged_at timestamptz;

comment on column public.offers.binding_acknowledged_at is
  'When the buyer confirmed the offer is binding for 48 hours unless withdrawn. Required on insert.';

-- ── 2. New offers: server-owned lifecycle ────────────────────────────────────

create or replace function public.offers_set_seller_from_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
begin
  select l.seller_id, l.listing_type::text as listing_type, l.accepts_offers
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

-- ── 3. Updates: expiry is binding on both sides ─────────────────────────────

create or replace function public.offers_enforce_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Service role (auth.uid() is null): the Stripe webhook recording payment
  -- of a counter, or the expiry sweep. Both are trusted.
  if auth.uid() is not null
     and old.status in ('pending', 'countered')
     and new.status in ('accepted', 'countered')
     and old.expires_at is not null
     and old.expires_at <= now() then
    raise exception 'This offer has expired' using errcode = '23514';
  end if;

  -- A counter is the seller's own binding proposal: the buyer gets a fresh
  -- 48 hours to accept it or let it lapse.
  if old.status = 'pending' and new.status = 'countered' then
    new.expires_at := now() + interval '48 hours';
  end if;

  if new.status in ('accepted', 'declined', 'countered') and new.responded_at is null then
    new.responded_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists offers_enforce_lifecycle on public.offers;
create trigger offers_enforce_lifecycle
  before update on public.offers
  for each row execute function public.offers_enforce_lifecycle();

-- ── 4. Expiry sweep ─────────────────────────────────────────────────────────

create or replace function public.expire_stale_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.offers
     set status = 'expired'
   where status in ('pending', 'countered')
     and expires_at is not null
     and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_offers() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-offers';
    perform cron.schedule('expire-stale-offers', '*/15 * * * *', 'select public.expire_stale_offers()');
  end if;
end;
$$;

-- ── 5. Notifications ────────────────────────────────────────────────────────

create or replace function public.notify_on_offer_created()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_card_name text;
  v_admin record;
begin
  select vi.card_name into v_card_name
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.listing_id;

  perform create_notification(
    new.seller_id, 'offer_received',
    'New offer received',
    'An offer of $' || new.amount_aud::text || ' on ' || coalesce(v_card_name, 'your listing')
      || ' — it expires in 48 hours if you don''t respond',
    '/account/offers', new.id
  );

  -- Every admin sees every offer. Skip an admin who is a party to it — the
  -- seller already has the notification above, and a buyer needs none.
  for v_admin in
    select id from public.profiles
     where is_admin = true and id <> new.seller_id and id <> new.buyer_id
  loop
    perform create_notification(
      v_admin.id, 'offer_received',
      'Marketplace offer made',
      '$' || new.amount_aud::text || ' offered on ' || coalesce(v_card_name, 'a listing'),
      '/product/marketplace/' || new.listing_id::text, new.id
    );
  end loop;

  return new;
end;
$function$;

create or replace function public.notify_on_offer_updated()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_card_name text;
  v_actor uuid;
begin
  if old.status = new.status then return new; end if;

  select vi.card_name into v_card_name
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.listing_id;

  -- Who performed the update? A seller accepts/declines a buyer's offer; a
  -- buyer accepts/declines a seller's counter — notify the OTHER party.
  -- auth.uid() is null for service-role updates; treat those as seller-driven.
  v_actor := auth.uid();

  if new.status = 'accepted' then
    if v_actor = new.buyer_id then
      perform create_notification(
        new.seller_id, 'offer_accepted',
        'Counter offer accepted! 🎉',
        'Your counter of $' || coalesce(new.counter_amount_aud::text, new.amount_aud::text)
          || ' on ' || coalesce(v_card_name, 'a listing') || ' was accepted',
        '/account/offers', new.id
      );
    elsif old.status <> 'countered' or v_actor is not null then
      -- (A service-role countered -> accepted is the buyer's payment landing;
      -- the order notifications cover that.)
      perform create_notification(
        new.buyer_id, 'offer_accepted',
        'Offer accepted! 🎉',
        'Your $' || new.amount_aud::text || ' offer on ' || coalesce(v_card_name, 'a listing')
          || ' was accepted — complete your purchase from My Offers',
        '/account/offers', new.id
      );
    end if;
  elsif new.status = 'declined' then
    if v_actor = new.buyer_id then
      perform create_notification(
        new.seller_id, 'offer_declined',
        'Counter offer declined',
        'Your counter of $' || coalesce(new.counter_amount_aud::text, new.amount_aud::text)
          || ' on ' || coalesce(v_card_name, 'a listing') || ' was not accepted',
        '/account/offers', new.id
      );
    else
      perform create_notification(
        new.buyer_id, 'offer_declined',
        'Offer declined',
        'Your offer on ' || coalesce(v_card_name, 'a listing') || ' was not accepted',
        '/account/offers', new.id
      );
    end if;
  elsif new.status = 'countered' then
    perform create_notification(
      new.buyer_id, 'offer_countered',
      'Counter offer received',
      'The seller countered with $' || coalesce(new.counter_amount_aud::text, '?')
        || ' on ' || coalesce(v_card_name, 'a listing') || ' — you have 48 hours to respond',
      '/account/offers', new.id
    );
  elsif new.status = 'withdrawn' then
    perform create_notification(
      new.seller_id, 'offer_declined',
      'Offer withdrawn',
      'The buyer withdrew their $' || new.amount_aud::text || ' offer on ' || coalesce(v_card_name, 'your listing'),
      '/account/offers', new.id
    );
  elsif new.status = 'expired' then
    perform create_notification(
      new.buyer_id, 'system',
      'Offer expired',
      'Your offer on ' || coalesce(v_card_name, 'a listing') || ' expired without a response — you are no longer bound by it',
      '/account/offers', new.id
    );
    perform create_notification(
      new.seller_id, 'system',
      'Offer expired',
      'An offer on ' || coalesce(v_card_name, 'your listing') || ' expired',
      '/account/offers', new.id
    );
  end if;
  return new;
end;
$function$;
