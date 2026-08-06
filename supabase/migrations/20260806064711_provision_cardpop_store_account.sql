-- Provision the platform's own storefront account: admin@cardpop.com.au.
--
-- This is the account CardPop itself sells from — an admin login that also
-- owns a dealer store on the marketplace. It needs five separate things
-- switched on, and every one of them is a column a normal user is FORBIDDEN
-- from writing to themselves (see the pins in profiles_update_access,
-- 20260802060200). So it has to be granted service-side, and a migration is
-- the repeatable, production-applied way to do it — same pattern as
-- 20260802062300_grant_owner_ultimate_membership.sql.
--
--   1. is_admin              → admin panel access. The trg_sync_admin_app_metadata
--                              trigger (20260619000001) mirrors this into
--                              auth.users.raw_app_meta_data so the backend's JWT
--                              claim check authorises it on the fast path.
--   2. is_verified +          → the identity gate. private.can_sell()
--      verification_status      (20260728205156) is `is_verified AND
--                               has_saved_card`, and the RESTRICTIVE policy
--                               listings_require_selling_entitlement calls it on
--                               every insert into public.listings.
--   3. has_saved_card         → the other half of that gate. Normally written by
--                               the Stripe setup-intent flow when a real card is
--                               attached; see the caveat below.
--   4. subscription_tier +    → Premium membership. 'grandfathered' is the status
--      subscription_status      config/subscription.js treats as entitled with no
--                               Stripe/PayPal subscription behind it, and which no
--                               provider webhook ever emits — so nothing external
--                               flips it back. Premium (not Pro) because the
--                               storefront perk starts at Pro but the Whatnot-show
--                               listing, homepage Featured Cards and priority
--                               Local Traders placement start at Premium
--                               (config/plans.js).
--   5. is_sole_trader +       → the dealer store itself. SoleTraderStorePage
--      store_slug +             resolves /dealer/<slug> and refuses to render
--      business_name            unless is_sole_trader is true, is_public is not
--                               false, and hasStorefront() passes on the tier.
--
-- CAVEATS — both deliberate, both worth knowing:
--
--   • is_verified is set here WITHOUT a Stripe Identity session. This is the
--     platform's own account, so there is no third party to verify; it is a
--     manual grant, not the result of an identity check. Do not copy this
--     pattern for a real seller — route them through identityService.
--   • has_saved_card is likewise asserted rather than earned. It means "this
--     account may list", not "Stripe holds a payment method for it". If the
--     account ever needs to be CHARGED (it is the seller, so normally it isn't),
--     attach a real card first. Note the Stripe setup-intent flow will happily
--     overwrite this column later — it only ever sets it true, so that is safe.
--
-- NOT covered here, because it cannot be: Stripe Connect payout onboarding
-- (stripe_connect_account_id / stripe_connect_onboarded). That is a KYC flow
-- that has to be completed by a human in the app — until it is, sale proceeds
-- accumulate in the seller wallet instead of paying out (see
-- src/services/payoutService.js and docs/stripe-connect.md).
--
-- Idempotent, and a no-op until the auth user exists: everything is keyed on
-- `lower(u.email) = 'admin@cardpop.com.au'`, so this migration applies cleanly
-- whether it runs before or after the account is created (see
-- scripts/create-cardpop-store-account.mjs and docs/cardpop-store-account.md).
-- Re-runs simply re-assert the same values.

-- ── Entitlements: admin + identity + selling + Premium membership ────────────
update public.profiles p
   set is_admin                = true,
       is_verified             = true,
       verification_status     = 'approved',
       identity_name_mismatch  = false,
       has_saved_card          = true,
       subscription_tier       = 'premium',
       subscription_status     = 'grandfathered',
       is_public               = true,
       is_active               = true,
       updated_at              = now()
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'admin@cardpop.com.au';

-- ── The dealer store ────────────────────────────────────────────────────────
-- store_slug carries a partial UNIQUE index (profiles_store_slug_key), so the
-- slug is only claimed when no OTHER profile already holds it — otherwise this
-- statement would abort the whole migration on a collision. The rest of the
-- store fields are set regardless; a slug clash is then a one-line manual fix,
-- not a failed deploy.
update public.profiles p
   set is_sole_trader   = true,
       business_name    = coalesce(nullif(p.business_name, ''), 'CardPop'),
       business_tagline = coalesce(nullif(p.business_tagline, ''),
                                   'Australia''s trading card marketplace.'),
       display_name     = coalesce(nullif(p.display_name, ''), 'CardPop'),
       store_slug       = coalesce(
                            p.store_slug,
                            case
                              when not exists (
                                select 1 from public.profiles o
                                 where o.store_slug = 'cardpop' and o.id <> p.id
                              ) then 'cardpop'
                            end
                          ),
       updated_at       = now()
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'admin@cardpop.com.au';
