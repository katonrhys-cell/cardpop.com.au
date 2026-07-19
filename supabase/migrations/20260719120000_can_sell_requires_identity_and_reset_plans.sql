-- Pricing model change: Hobby (free) vs Pro ($/mo).
--
-- Two things change here, both backward-compatible and idempotent:
--
-- 1. The selling gate stops depending on a paid subscription. In the new model
--    ANY account (free Hobby included) may list/sell/trade once it has completed
--    Stripe Identity verification — it just pays the normal per-transaction fee.
--    So `can_sell()` now keys off `profiles.is_verified` (identity) instead of
--    `subscription_status` / `trial_ends_at`. The RESTRICTIVE RLS policy on
--    `listings` (listings_require_selling_entitlement) keeps calling can_sell(),
--    so it automatically switches to the identity gate with no policy change.
--
-- 2. Everyone starts on Hobby. The old rollout grandfathered legacy accounts to
--    subscription_status='grandfathered' (which used to grant selling). Selling
--    no longer needs a subscription, and Pro must be opted into, so we retire the
--    grandfathered status back to 'none' and make sure subscription_tier='free'.
--    Pro is granted only when the Stripe/PayPal subscription webhook flips the
--    tier (see src/services/subscriptionService.js). No one is charged by this.
--
-- The Pro membership itself is still enforced app-side via subscription_status /
-- subscription_tier — this migration only governs the selling gate + reset.

-- ── Selling gate now = identity verification ─────────────────────────────────
create or replace function public.can_sell(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and coalesce(p.is_verified, false) = true
  );
$$;

-- `create or replace` preserves existing grants, but re-assert them so this
-- migration is self-contained and matches 20260702000001_lockdown_can_sell_fn.
revoke execute on function public.can_sell(uuid) from public;
revoke execute on function public.can_sell(uuid) from anon;
grant  execute on function public.can_sell(uuid) to authenticated;

-- ── Everyone → Hobby (free) ──────────────────────────────────────────────────
-- Retire the legacy grandfathered members: they become free Hobby accounts and
-- can upgrade to Pro whenever they like. Real paying members (status 'active' /
-- 'trialing' from a live Stripe/PayPal subscription) are left untouched.
update public.profiles
  set subscription_status = 'none'
  where subscription_status = 'grandfathered';

-- Ensure the account-plan column has a concrete Hobby value everywhere. The
-- column already defaults to 'free'; this backfills any historical NULLs.
update public.profiles
  set subscription_tier = 'free'
  where subscription_tier is null;
