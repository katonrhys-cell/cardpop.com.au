-- Welcome offers: a single-use promo code generated for every new registration
-- and emailed separately from the verification email. Redeeming the code gives
-- the new user:
--   1. a free 30-day selling trial (sets profiles.trial_ends_at, which
--      can_sell() already honours — no card required), and
--   2. 10% off their first order (applied as a Stripe discount at checkout).
--
-- One offer per user, one redemption per benefit. All writes go through the
-- backend with the service-role key; users can only read their own offer.
-- Offer parameters are also defined in `config/welcomeOffer.js` — the values
-- here are only column defaults for rows created without explicit values.

create table if not exists public.welcome_offers (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,
  code                 text not null unique,
  trial_days           integer not null default 30,
  discount_pct         numeric not null default 10,
  expires_at           timestamptz not null,
  email_sent_at        timestamptz,
  trial_redeemed_at    timestamptz,
  discount_redeemed_at timestamptz,
  discount_order_id    uuid,
  created_at           timestamptz not null default now()
);

create index if not exists welcome_offers_user_id_idx on public.welcome_offers (user_id);

alter table public.welcome_offers enable row level security;

-- Users may see their own offer (so the account page can surface the code and
-- its redemption state). Inserts/updates happen only via the service role,
-- which bypasses RLS — no write policies are granted.
drop policy if exists welcome_offers_select_own on public.welcome_offers;
create policy welcome_offers_select_own
  on public.welcome_offers
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Orders record how much welcome discount was applied so totals reconcile
-- (total_aud is the discounted amount actually charged by Stripe).
alter table public.orders
  add column if not exists discount_aud numeric not null default 0;
