-- Close a gap in the self-update RLS policy on public.profiles.
--
-- "Users can update their own profile" (base policy, predates repo-tracked
-- migrations — see profiles table history) already locks is_admin,
-- is_verified, seller_tier, total_sales, total_purchases and
-- verification_status against self-editing, requiring each to stay equal to
-- the row's current value. But wallet_balance_aud (added in
-- 20260626000005_add_wallet_balance_to_profiles.sql), and
-- subscription_status / subscription_provider / trial_ends_at / stripe /
-- paypal identifiers (added in 20260701000001_add_subscription_trial.sql and
-- 20260706094513_add_stripe_identity_verification.sql) were never added to
-- that immutable-column list — those migrations extended the table but not
-- the policy guarding it. Without this, any authenticated user could run
-- e.g. supabase.from('profiles').update({ wallet_balance_aud: 999999 }) or
-- grant themselves an active subscription/extended trial directly from the
-- browser.
--
-- This recreates the policy with the same shape (same USING clause, same
-- immutability pattern for the existing locked columns) plus the missing
-- financial/entitlement/identity columns.

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and not (is_admin is distinct from (select p.is_admin from public.profiles p where p.id = auth.uid()))
    and not (is_verified is distinct from (select p.is_verified from public.profiles p where p.id = auth.uid()))
    and not (seller_tier is distinct from (select p.seller_tier from public.profiles p where p.id = auth.uid()))
    and not (total_sales is distinct from (select p.total_sales from public.profiles p where p.id = auth.uid()))
    and not (total_purchases is distinct from (select p.total_purchases from public.profiles p where p.id = auth.uid()))
    and not (verification_status is distinct from (select p.verification_status from public.profiles p where p.id = auth.uid()))
    and not (wallet_balance_aud is distinct from (select p.wallet_balance_aud from public.profiles p where p.id = auth.uid()))
    and not (subscription_status is distinct from (select p.subscription_status from public.profiles p where p.id = auth.uid()))
    and not (subscription_provider is distinct from (select p.subscription_provider from public.profiles p where p.id = auth.uid()))
    and not (trial_ends_at is distinct from (select p.trial_ends_at from public.profiles p where p.id = auth.uid()))
    and not (stripe_customer_id is distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid()))
    and not (stripe_subscription_id is distinct from (select p.stripe_subscription_id from public.profiles p where p.id = auth.uid()))
    and not (paypal_subscription_id is distinct from (select p.paypal_subscription_id from public.profiles p where p.id = auth.uid()))
    and not (stripe_identity_session_id is distinct from (select p.stripe_identity_session_id from public.profiles p where p.id = auth.uid()))
  );
