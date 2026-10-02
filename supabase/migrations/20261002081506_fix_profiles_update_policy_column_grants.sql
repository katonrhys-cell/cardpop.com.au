-- Fix "permission denied for table profiles" on every self-service profile save.
--
-- profiles_update_access pins the locked columns (financial, identity,
-- reputation, admin flags) by comparing each new value against a subquery
-- `(select p.<col> from profiles p where p.id = auth.uid())`. Those subqueries
-- run with the caller's privileges, and 20260715210000 (plus later column
-- additions) left several of the pinned columns — wallet_balance_aud,
-- stripe_customer_id, legal_name, email, … — deliberately without a client
-- SELECT grant. Postgres checks column privileges for every subquery in the
-- policy at plan time, so ANY update to profiles from the browser (Public
-- Profile, Sole Trader, onboarding…) failed with 42501, admins included.
--
-- Fix: read the caller's current row through a SECURITY DEFINER helper that
-- only ever returns the caller's own row (auth.uid()), so no column is exposed
-- that the user couldn't already learn about themselves, and the pin semantics
-- are unchanged. The column privilege revokes stay exactly as they are.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p from public.profiles p where p.id = (select auth.uid());
$$;

revoke all on function private.current_profile() from public, anon;
grant execute on function private.current_profile() to authenticated, service_role;

drop policy if exists profiles_update_access on public.profiles;

create policy profiles_update_access on public.profiles
  for update
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or (select auth.uid()) = id
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or (
      (select auth.uid()) = id
      and not (is_admin is distinct from (private.current_profile()).is_admin)
      and not (is_verified is distinct from (private.current_profile()).is_verified)
      and not (seller_tier is distinct from (private.current_profile()).seller_tier)
      and not (total_sales is distinct from (private.current_profile()).total_sales)
      and not (total_purchases is distinct from (private.current_profile()).total_purchases)
      and not (verification_status is distinct from (private.current_profile()).verification_status)
      and not (wallet_balance_aud is distinct from (private.current_profile()).wallet_balance_aud)
      and not (subscription_status is distinct from (private.current_profile()).subscription_status)
      and not (subscription_provider is distinct from (private.current_profile()).subscription_provider)
      and not (trial_ends_at is distinct from (private.current_profile()).trial_ends_at)
      and not (stripe_customer_id is distinct from (private.current_profile()).stripe_customer_id)
      and not (stripe_subscription_id is distinct from (private.current_profile()).stripe_subscription_id)
      and not (paypal_subscription_id is distinct from (private.current_profile()).paypal_subscription_id)
      and not (stripe_identity_session_id is distinct from (private.current_profile()).stripe_identity_session_id)
      and not (identity_name_mismatch is distinct from (private.current_profile()).identity_name_mismatch)
      and not (payout_name_mismatch is distinct from (private.current_profile()).payout_name_mismatch)
      and not (rating is distinct from (private.current_profile()).rating)
      and not (positive_feedback_pct is distinct from (private.current_profile()).positive_feedback_pct)
      and not (reviews_count is distinct from (private.current_profile()).reviews_count)
      and not (successful_sales is distinct from (private.current_profile()).successful_sales)
      and not (is_featured_seller is distinct from (private.current_profile()).is_featured_seller)
      and not (has_saved_card is distinct from (private.current_profile()).has_saved_card)
      and not (stripe_connect_account_id is distinct from (private.current_profile()).stripe_connect_account_id)
      and not (stripe_connect_onboarded is distinct from (private.current_profile()).stripe_connect_onboarded)
      and not (legal_name is distinct from (private.current_profile()).legal_name)
      and not (subscription_tier is distinct from (private.current_profile()).subscription_tier)
      and not (email is distinct from (private.current_profile()).email)
    )
  );
