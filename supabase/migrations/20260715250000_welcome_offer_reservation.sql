-- Add a reservation marker to welcome_offers so a one-time welcome discount
-- can't be applied to several concurrent checkouts.
--
-- The discount is a one-time, platform-funded coupon, but validateWelcomeDiscount
-- only checked `discount_redeemed_at`, which is set solely by the completion
-- webhook. So a buyer could open N checkouts with the same code before any
-- completes — each minting a fresh coupon — and redeem the "one-time" 10%
-- discount on several orders (bounded to 10% of item subtotal, so Medium, but a
-- real platform-funded loss).
--
-- discount_reserved_at lets the backend atomically claim the offer for a single
-- in-flight checkout (see reserveWelcomeDiscount): a compare-and-swap that only
-- succeeds when the offer is unredeemed and not currently reserved (or the prior
-- reservation is stale). It's cleared when the checkout session expires
-- (releaseWelcomeDiscount, from the checkout.session.expired webhook), and a
-- staleness window in the CAS is the safety net if that webhook is ever missed.
alter table public.welcome_offers
  add column if not exists discount_reserved_at timestamptz;
