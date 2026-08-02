-- Grant the platform owner/admin account a complimentary Ultimate membership.
--
-- The owner account (resolved by auth email) gets subscription_tier
-- 'ultimate' with subscription_status 'grandfathered' — the status
-- config/subscription.js treats as entitled without any Stripe/PayPal
-- subscription behind it, and which no provider webhook ever emits, so
-- nothing external will flip it back. subscription_tier is locked against
-- self-writes (20260802060200), so this has to happen service-side: a
-- migration is the repeatable, production-applied way to do it.
--
-- Caveat: if this account ever completes a REAL subscription checkout, the
-- provider webhook (applyStripeSubscription / applyPaypalSubscription) will
-- overwrite both columns with the purchased subscription's state — don't
-- subscribe from the owner account.
--
-- Idempotent: a plain UPDATE keyed on the auth email; re-runs are no-ops.
update public.profiles p
   set subscription_tier   = 'ultimate',
       subscription_status = 'grandfathered'
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'katonrhys@gmail.com';
