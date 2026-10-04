-- Give the platform's admin / owner accounts the TOP membership tier (Ultimate)
-- at no cost.
--
-- Three accounts, resolved by auth email:
--
--   admin@cardpop.com.au    — the platform's own storefront + admin login. It
--                             was provisioned at Premium (20260806064711); the
--                             owner wants it on the top tier.
--   katonrhys@gmail.com     — the owner account. Already Ultimate via
--                             20260802062300; re-asserted here so this file is
--                             the one place that says who holds the free top tier.
--   rfkates09@hotmail.com   — the owner's second account.
--
-- 'ultimate' is the highest tier in config/subscription.js PAID_TIER_ORDER
-- (pro < premium < elite < ultimate) and unlocks everything: unlimited
-- listings per month, the storefront, every display style. 'grandfathered' is
-- the subscription_status config/subscription.js treats as entitled with no
-- Stripe/PayPal subscription behind it, and which no provider webhook ever
-- emits — so nothing external flips it back and nothing is ever billed.
--
-- subscription_tier / subscription_status are locked against self-writes
-- (20260802060200), so this has to happen service-side; a migration is the
-- repeatable, production-applied way to do it (same pattern as the two
-- migrations above).
--
-- Only the membership columns are touched. is_admin is deliberately NOT set
-- here — admin access is a separate decision from membership tier.
--
-- Caveat: if one of these accounts ever completes a REAL subscription checkout,
-- the provider webhook (applyStripeSubscription / applyPaypalSubscription)
-- overwrites both columns with the purchased subscription's state — don't
-- subscribe from these accounts.
--
-- Idempotent, and a no-op for any email whose auth user doesn't exist yet
-- (re-run after the account is created, or re-apply this file). Re-runs
-- simply re-assert the same values.
update public.profiles p
   set subscription_tier   = 'ultimate',
       subscription_status = 'grandfathered',
       updated_at          = now()
  from auth.users u
 where u.id = p.id
   and lower(u.email) in (
     'admin@cardpop.com.au',
     'katonrhys@gmail.com',
     'rfkates09@hotmail.com'
   )
   and (p.subscription_tier is distinct from 'ultimate'
        or p.subscription_status is distinct from 'grandfathered');
