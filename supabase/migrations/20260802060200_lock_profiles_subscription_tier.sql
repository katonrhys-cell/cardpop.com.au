-- Lock profiles.subscription_tier against user self-writes.
--
-- subscription_tier is the ACCOUNT PLAN column ('free' | 'pro' | 'premium' |
-- 'elite' | 'ultimate'). It is written only by the subscription webhooks /
-- services (service role) as the Stripe/PayPal lifecycle changes — see
-- src/services/subscriptionService.js.
--
-- The self-update branch of profiles_update_access (last recreated in
-- 20260730201900) pins subscription_status / subscription_provider /
-- trial_ends_at and the provider ids — but NOT subscription_tier. Since
-- isProAccount() (config/plans.js) trusts the tier column alone, a signed-in
-- user could run
--   supabase.from('profiles').update({ subscription_tier: 'ultimate' })
--     .eq('id', self)
-- with the shipped anon key and self-grant everything the paid tiers gate:
-- the unlimited monthly listing quota (enforce_monthly_listing_quota reads
-- this column), the /dealer storefront + Local Traders placement, and the
-- premium display styles. Pin it like the rest of the billing columns.
--
-- Legitimate writers are unaffected: admins take the EXISTS(is_admin) branch,
-- and the subscription services run with the service role (RLS bypassed).
drop policy if exists "profiles_update_access" on public.profiles;
create policy "profiles_update_access" on public.profiles as permissive for UPDATE to public
  using (
    (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))
    or ((select auth.uid()) = id)
  )
  with check (
    (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true))))
    or (
      ((select auth.uid()) = id)
      AND (NOT (is_admin IS DISTINCT FROM ( SELECT p.is_admin FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (is_verified IS DISTINCT FROM ( SELECT p.is_verified FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (seller_tier IS DISTINCT FROM ( SELECT p.seller_tier FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (total_sales IS DISTINCT FROM ( SELECT p.total_sales FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (total_purchases IS DISTINCT FROM ( SELECT p.total_purchases FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (verification_status IS DISTINCT FROM ( SELECT p.verification_status FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (wallet_balance_aud IS DISTINCT FROM ( SELECT p.wallet_balance_aud FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (subscription_status IS DISTINCT FROM ( SELECT p.subscription_status FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (subscription_provider IS DISTINCT FROM ( SELECT p.subscription_provider FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (trial_ends_at IS DISTINCT FROM ( SELECT p.trial_ends_at FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (stripe_customer_id IS DISTINCT FROM ( SELECT p.stripe_customer_id FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (stripe_subscription_id IS DISTINCT FROM ( SELECT p.stripe_subscription_id FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (paypal_subscription_id IS DISTINCT FROM ( SELECT p.paypal_subscription_id FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (stripe_identity_session_id IS DISTINCT FROM ( SELECT p.stripe_identity_session_id FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (identity_name_mismatch IS DISTINCT FROM ( SELECT p.identity_name_mismatch FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (payout_name_mismatch IS DISTINCT FROM ( SELECT p.payout_name_mismatch FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (rating IS DISTINCT FROM ( SELECT p.rating FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (positive_feedback_pct IS DISTINCT FROM ( SELECT p.positive_feedback_pct FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (reviews_count IS DISTINCT FROM ( SELECT p.reviews_count FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (successful_sales IS DISTINCT FROM ( SELECT p.successful_sales FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (is_featured_seller IS DISTINCT FROM ( SELECT p.is_featured_seller FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (has_saved_card IS DISTINCT FROM ( SELECT p.has_saved_card FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (stripe_connect_account_id IS DISTINCT FROM ( SELECT p.stripe_connect_account_id FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (stripe_connect_onboarded IS DISTINCT FROM ( SELECT p.stripe_connect_onboarded FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (legal_name IS DISTINCT FROM ( SELECT p.legal_name FROM profiles p WHERE (p.id = (select auth.uid())))))
      -- Newly locked: the account-plan column every paid feature keys off.
      AND (NOT (subscription_tier IS DISTINCT FROM ( SELECT p.subscription_tier FROM profiles p WHERE (p.id = (select auth.uid())))))
    )
  );
