-- Lock system-maintained reputation / trust columns against user self-writes.
--
-- The profiles UPDATE policy (profiles_update_access, last set in
-- 20260719113047_consolidate_multiple_permissive_policies.sql) lets a user
-- update their own row (auth.uid() = id) and its WITH CHECK pins the financial /
-- identity columns to their existing values. But it does NOT pin the
-- publicly-displayed, system-maintained reputation and trust columns:
--   rating, positive_feedback_pct, reviews_count, successful_sales,
--   is_featured_seller, has_saved_card
-- With the shipped anon key a user can therefore run
--   supabase.from('profiles').update({ rating: 5, positive_feedback_pct: 100,
--     successful_sales: 999, reviews_count: 500, is_featured_seller: true })
--     .eq('id', self)
-- to fabricate marketplace reputation and grant themselves the homepage
-- "Featured Seller" placement — bypassing the admin-only admin_set_featured_seller
-- RPC (20260709210057) that was built precisely to gate is_featured_seller.
-- has_saved_card gates selling (can_sell) and must only be set by the Stripe
-- sync in src/routes/wallet.js (service role), never self-set.
--
-- Legitimate writers are unaffected: admins update via the admin branch of this
-- policy (EXISTS is_admin), and the reputation columns / has_saved_card are
-- maintained by service-role backend code and SECURITY DEFINER RPCs, both of
-- which bypass RLS. Recreate the policy adding the six columns to the
-- self-branch lock list (same "new value must equal the stored value" pattern
-- the existing locks use).
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
      -- Newly locked: system-maintained reputation + trust columns.
      AND (NOT (rating IS DISTINCT FROM ( SELECT p.rating FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (positive_feedback_pct IS DISTINCT FROM ( SELECT p.positive_feedback_pct FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (reviews_count IS DISTINCT FROM ( SELECT p.reviews_count FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (successful_sales IS DISTINCT FROM ( SELECT p.successful_sales FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (is_featured_seller IS DISTINCT FROM ( SELECT p.is_featured_seller FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (has_saved_card IS DISTINCT FROM ( SELECT p.has_saved_card FROM profiles p WHERE (p.id = (select auth.uid())))))
    )
  );
