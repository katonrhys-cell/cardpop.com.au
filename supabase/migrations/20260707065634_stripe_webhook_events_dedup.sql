-- Webhook idempotency at the event boundary. Handlers already have per-action
-- idempotency (unique stripe_session_id, compare-and-swap on order status,
-- claimListingSold), but there is no dedup on the Stripe event.id itself, so a
-- redelivered event re-runs every handler. This table records each successfully
-- processed event id; the webhook checks it on entry and skips duplicates.
--
-- service_role only (the backend webhook uses the service-role client); no anon/
-- authenticated access. Idempotent DDL.

create table if not exists public.stripe_webhook_events (
  event_id   text primary key,
  type       text,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- No policies for anon/authenticated: the service-role client bypasses RLS, so
-- the backend can read/write while the public API surface exposes nothing.

comment on table public.stripe_webhook_events is
  'Processed Stripe webhook event ids for idempotency. Written by the backend webhook (service_role) only.';
