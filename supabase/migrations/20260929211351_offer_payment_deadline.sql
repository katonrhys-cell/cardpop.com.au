-- Offers: a payment deadline once accepted, and admin visibility of the whole
-- lifecycle.
--
-- 1. offers.payment_due_at / offers.paid_at. Accepting an offer (the seller
--    accepting the buyer's amount, or the buyer accepting the seller's
--    counter) starts a 48-hour window for the buyer to pay. paid_at is stamped
--    by the Stripe webhook when checkout completes.
--
-- 2. offers_enforce_lifecycle (replaced): lifecycle columns — expires_at,
--    payment_due_at, paid_at — are server-owned. A buyer or seller can only
--    move the status (RLS decides which moves); anything else they send in the
--    same update is discarded, so nobody can extend their own deadline or mark
--    their own offer paid.
--
-- 3. expire_stale_offers() (replaced): also lapses accepted offers whose
--    payment window closed unpaid, which frees the seller to sell elsewhere.
--
-- 4. Notifications: an unpaid lapse tells the buyer, the seller and every
--    admin; admin offer notifications now link to Admin -> Offers.

-- ── 1. Columns ──────────────────────────────────────────────────────────────

alter table public.offers
  add column if not exists payment_due_at timestamptz,
  add column if not exists paid_at timestamptz;

comment on column public.offers.payment_due_at is
  'Set when the offer is accepted: the buyer must pay by then or the offer lapses.';
comment on column public.offers.paid_at is
  'Set by the Stripe webhook when checkout for this offer completes.';

create index if not exists idx_offers_awaiting_payment
  on public.offers (payment_due_at)
  where status = 'accepted' and paid_at is null;

-- ── 2. Lifecycle trigger ────────────────────────────────────────────────────

create or replace function public.offers_enforce_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Buyers and sellers (auth.uid() set) never write lifecycle columns
  -- directly; the service role (webhook, expiry sweep) is trusted.
  if auth.uid() is not null then
    new.expires_at := old.expires_at;
    new.payment_due_at := old.payment_due_at;
    new.paid_at := old.paid_at;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

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

  -- Agreement reached: the buyer now has 48 hours to pay. (When the webhook
  -- records payment of a counter it sets paid_at in the same update, so no
  -- deadline is needed.)
  if new.status = 'accepted' and new.paid_at is null and new.payment_due_at is null then
    new.payment_due_at := now() + interval '48 hours';
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

-- ── 3. Expiry sweep ─────────────────────────────────────────────────────────

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
   where (status in ('pending', 'countered') and expires_at is not null and expires_at <= now())
      or (status = 'accepted' and paid_at is null and payment_due_at is not null and payment_due_at <= now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_offers() from public, anon, authenticated;

-- ── 4. Notifications ────────────────────────────────────────────────────────

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

  for v_admin in
    select id from public.profiles
     where is_admin = true and id <> new.seller_id and id <> new.buyer_id
  loop
    perform create_notification(
      v_admin.id, 'offer_received',
      'Marketplace offer made',
      '$' || new.amount_aud::text || ' offered on ' || coalesce(v_card_name, 'a listing'),
      '/admin/offers', new.id
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
  v_admin record;
  v_agreed text;
begin
  if old.status = new.status then return new; end if;

  select vi.card_name into v_card_name
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.listing_id;

  v_actor := auth.uid();
  v_agreed := coalesce(new.counter_amount_aud, new.amount_aud)::text;

  if new.status = 'accepted' then
    if v_actor = new.buyer_id then
      perform create_notification(
        new.seller_id, 'offer_accepted',
        'Counter offer accepted! 🎉',
        'Your counter of $' || v_agreed || ' on ' || coalesce(v_card_name, 'a listing')
          || ' was accepted — the buyer has 48 hours to pay',
        '/account/offers', new.id
      );
    elsif v_actor is not null then
      perform create_notification(
        new.buyer_id, 'offer_accepted',
        'Offer accepted! 🎉',
        'Your $' || new.amount_aud::text || ' offer on ' || coalesce(v_card_name, 'a listing')
          || ' was accepted — pay within 48 hours to secure it',
        '/account/offers', new.id
      );
    end if;
    -- (A service-role accept is the webhook recording payment; the order
    -- notifications cover that.)
  elsif new.status = 'declined' then
    if v_actor = new.buyer_id then
      perform create_notification(
        new.seller_id, 'offer_declined',
        'Counter offer declined',
        'Your counter of $' || v_agreed || ' on ' || coalesce(v_card_name, 'a listing') || ' was not accepted',
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
  elsif new.status = 'expired' and old.status = 'accepted' then
    -- Agreed but never paid: the buyer broke a binding offer.
    perform create_notification(
      new.buyer_id, 'system',
      'Offer payment window closed',
      'You didn''t pay for ' || coalesce(v_card_name, 'the card') || ' within 48 hours of your offer being accepted, so the deal has lapsed',
      '/account/offers', new.id
    );
    perform create_notification(
      new.seller_id, 'system',
      'Buyer didn''t pay',
      'The buyer didn''t pay $' || v_agreed || ' for ' || coalesce(v_card_name, 'your listing')
        || ' within 48 hours — the deal has lapsed and your listing is free to sell',
      '/account/offers', new.id
    );
    for v_admin in
      select id from public.profiles
       where is_admin = true and id <> new.seller_id and id <> new.buyer_id
    loop
      perform create_notification(
        v_admin.id, 'system',
        'Accepted offer went unpaid',
        '$' || v_agreed || ' on ' || coalesce(v_card_name, 'a listing') || ' — the buyer didn''t pay within 48 hours',
        '/admin/offers', new.id
      );
    end loop;
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
