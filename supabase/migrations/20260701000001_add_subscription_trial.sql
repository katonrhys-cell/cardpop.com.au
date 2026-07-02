-- Free-trial + subscription state for sellers.
--
-- Why: new users get a 30-day free trial (card on file), after which an active
-- subscription is required to keep LISTING/SELLING. Browsing, buying and
-- community features stay free. This migration adds the columns that mirror the
-- Stripe/PayPal subscription onto the profile, a `can_sell()` helper, and a
-- RESTRICTIVE row-level-security policy that enforces the gate at the database
-- (so it can't be bypassed by writing to `listings` directly with the anon key).
--
-- Trial length and the entitled statuses are also defined in
-- `config/subscription.js` — keep the two in sync if you change them.
--
-- IMPORTANT: apply this BEFORE (or together with) the matching app deploy.

-- ── Profile columns ──────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists subscription_status   text not null default 'none',
  add column if not exists subscription_provider text,           -- 'stripe' | 'paypal' | null
  add column if not exists trial_ends_at         timestamptz,    -- mirror of the provider trial end
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists paypal_subscription_id text;

-- Keep provider-id lookups (used by webhooks) fast.
create index if not exists idx_profiles_stripe_customer     on public.profiles (stripe_customer_id)     where stripe_customer_id is not null;
create index if not exists idx_profiles_stripe_subscription on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists idx_profiles_paypal_subscription on public.profiles (paypal_subscription_id) where paypal_subscription_id is not null;

-- ── Grandfather existing accounts ────────────────────────────────────────────
-- Everyone who registered before the paywall keeps selling with no interruption.
-- New sign-ups get 'none' and must add a payment method to enter the trial.
update public.profiles
  set subscription_status = 'grandfathered'
  where subscription_status = 'none'
    and created_at < now();

-- ── Entitlement helper ───────────────────────────────────────────────────────
-- Returns true when the given user may list/sell: an active or trialing
-- subscription, a grandfathered account, or an as-yet-unexpired trial window.
-- SECURITY DEFINER + a pinned search_path so it is safe to call from RLS.
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
      and (
        p.subscription_status in ('trialing', 'active', 'grandfathered')
        or (p.trial_ends_at is not null and p.trial_ends_at > now())
      )
  );
$$;

grant execute on function public.can_sell(uuid) to authenticated;

-- ── Enforce the gate on listing creation ─────────────────────────────────────
-- A RESTRICTIVE policy is AND-combined with whatever permissive INSERT policies
-- already exist on `listings`, so it tightens access without needing to know or
-- replace them. The service_role key (used by the backend) bypasses RLS, so
-- server-side inserts are unaffected.
drop policy if exists listings_require_selling_entitlement on public.listings;
create policy listings_require_selling_entitlement
  on public.listings
  as restrictive
  for insert
  to authenticated
  with check (public.can_sell(auth.uid()));
