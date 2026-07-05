-- Expression of Interest listings + offer notifications.
--
-- 1. listings.price_min_aud / price_max_aud — the indicative price range a
--    seller publishes on an 'expression_of_interest' listing ("I'm looking
--    for offers between $X and $Y"). Nullable; only EOI listings use them.
-- 2. notifications.read_at — the frontend (hooks/useNotifications.js) already
--    writes this column when marking notifications read; it never existed, so
--    every mark-as-read update was silently failing.
-- 3. RLS: buyers may respond to a countered offer (accept/decline). Until now
--    only sellers could move an offer out of 'pending', so a counter-offer
--    was a dead end for the buyer.
-- 4. Bring the offer notification triggers into the repo and fix their
--    recipient logic. The remote project already has hand-applied triggers
--    (on_offer_created / on_offer_updated → notify_on_offer_created /
--    notify_on_offer_updated using the create_notification() helper), but
--    they always notify the BUYER on accepted/declined — wrong for the new
--    counter-offer flow, where the BUYER accepts/declines the seller's
--    counter and the SELLER must be told. Offers are written straight from
--    the browser under RLS and notifications has no INSERT policy for
--    regular users, so this fan-out must stay in security-definer triggers.
--
-- IMPORTANT: the application code that writes/reads these columns ships in
-- the same change set — apply this migration before (or together with) that
-- deploy.

-- ── 1. Price range for expression-of-interest listings ─────────────────────

alter table public.listings
  add column if not exists price_min_aud numeric,
  add column if not exists price_max_aud numeric;

comment on column public.listings.price_min_aud is
  'Lower bound of the indicative price range on an expression_of_interest listing.';
comment on column public.listings.price_max_aud is
  'Upper bound of the indicative price range on an expression_of_interest listing.';

-- ── 2. notifications.read_at (frontend already writes it) ──────────────────

alter table public.notifications
  add column if not exists read_at timestamptz;

-- ── 3. Buyers can respond to a counter-offer ────────────────────────────────

drop policy if exists "Buyers can respond to countered offers" on public.offers;
create policy "Buyers can respond to countered offers"
  on public.offers
  for update
  using (auth.uid() = buyer_id and status = 'countered'::offer_status)
  with check (
    auth.uid() = buyer_id
    and status = any (array['accepted'::offer_status, 'declined'::offer_status])
  );

-- ── 4. Offer notification triggers ──────────────────────────────────────────
-- Replaces the hand-applied function bodies (same names, same trigger
-- bindings, same create_notification() helper) so the repo is the source of
-- truth and the recipient logic understands buyer counter-responses.

create or replace function public.notify_on_offer_created()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_card_name text;
begin
  select vi.card_name into v_card_name
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.listing_id;
  perform create_notification(
    new.seller_id, 'offer_received',
    'New offer received',
    'An offer of $' || new.amount_aud::text || ' on ' || coalesce(v_card_name, 'your listing'),
    '/account/offers', new.id
  );
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
  -- auth.uid() is null for service-role updates; treat those as seller-driven
  -- (matches the pre-existing behaviour of always notifying the buyer).
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
    else
      perform create_notification(
        new.buyer_id, 'offer_accepted',
        'Offer accepted! 🎉',
        'Your $' || new.amount_aud::text || ' offer on ' || coalesce(v_card_name, 'a listing') || ' was accepted',
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
        || ' on ' || coalesce(v_card_name, 'a listing'),
      '/account/offers', new.id
    );
  end if;
  return new;
end;
$function$;

-- Idempotently (re)bind the triggers under their existing names so a fresh
-- environment gets them too; on the current project this is a no-op rebind.
drop trigger if exists on_offer_created on public.offers;
create trigger on_offer_created
  after insert on public.offers
  for each row execute function public.notify_on_offer_created();

drop trigger if exists on_offer_updated on public.offers;
create trigger on_offer_updated
  after update on public.offers
  for each row execute function public.notify_on_offer_updated();
