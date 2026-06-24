-- Idempotency guard for the Stripe webhook.
--
-- The checkout.session.completed handler (src/routes/stripe.js) keys an order to
-- its Stripe Checkout session. Stripe can deliver the same event more than once
-- (retries / at-least-once delivery), and without a uniqueness guarantee two
-- concurrent deliveries could both insert an order for the same session and both
-- run the seller payout (stripe.transfers.create) / wallet credit — double-paying
-- the seller.
--
-- A unique index on stripe_session_id turns the INSERT into an atomic claim: the
-- first delivery wins, any concurrent retry fails with a unique violation (23505)
-- which the webhook treats as an idempotent skip. NULLs are allowed and never
-- collide in Postgres, so orders without a session id are unaffected.
--
-- NOTE: if duplicate non-null stripe_session_id rows already exist (from prior
-- double-processing) this index creation will fail — de-duplicate those rows
-- first, then re-run.
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON public.orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
