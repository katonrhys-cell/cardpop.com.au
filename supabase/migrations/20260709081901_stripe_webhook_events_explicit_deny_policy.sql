-- Silence the "RLS Enabled No Policy" advisor (lint 0008) on
-- public.stripe_webhook_events by making its lock-down explicit.
--
-- The table is written and read ONLY by the backend Stripe webhook via the
-- service-role client, which BYPASSES RLS. RLS is enabled with no policies,
-- which already denies anon/authenticated everything — the correct, secure
-- posture. The advisor flags "enabled but no policy" purely so a human
-- confirms the omission is intentional. Add an explicit deny-all policy for
-- the two API roles: it documents the intent and clears the notice WITHOUT
-- changing behaviour (service_role still bypasses RLS entirely, and
-- using(false)/with check(false) matches no rows — identical to having no
-- policy for anon/authenticated).

drop policy if exists stripe_webhook_events_no_public_access on public.stripe_webhook_events;
create policy stripe_webhook_events_no_public_access
  on public.stripe_webhook_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
