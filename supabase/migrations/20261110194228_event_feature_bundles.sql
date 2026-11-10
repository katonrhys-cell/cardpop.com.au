-- The 3-event Featured Placement pack (BUNDLE in utils/featuredPackages.js).
--
-- A pack is one Stripe Checkout Session covering three events, so it writes
-- three event_feature_purchases rows that share a bundle_id and the same
-- stripe_session_id. Each row keeps its own event's share of the charge, so
-- the rows still add up to what Stripe took and "one paid featuring per event"
-- (event_feature_purchases_one_paid_per_event) is unchanged.

alter table public.event_feature_purchases
  add column if not exists bundle_id uuid;

-- stripe_session_id was unique (one row per session). A pack has three rows
-- per session, so uniqueness moves to (session, event).
alter table public.event_feature_purchases
  drop constraint if exists event_feature_purchases_stripe_session_id_key;

create unique index if not exists event_feature_purchases_session_event
  on public.event_feature_purchases (stripe_session_id, event_id)
  where stripe_session_id is not null;

create index if not exists event_feature_purchases_bundle_idx
  on public.event_feature_purchases (bundle_id)
  where bundle_id is not null;
