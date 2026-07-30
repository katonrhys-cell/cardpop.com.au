-- Lock profiles.legal_name against user self-writes.
--
-- legal_name is the name read off the user's IDENTITY DOCUMENT. It is written
-- only by identityService.applyIdentitySession() from the Stripe Identity
-- verification result (service role), and it is already unreadable by the
-- browser — 20260715210000 left it out of the column-level SELECT grant.
--
-- But nothing stopped a user WRITING it. profiles has a table-wide UPDATE grant
-- for `authenticated`, and the self-update branch of profiles_update_access
-- (last recreated in 20260720150000) pins a long list of financial/identity
-- columns to their stored values — legal_name is not among them. So with the
-- shipped anon key a signed-in user could run
--   supabase.from('profiles').update({ legal_name: 'Their Display Name' })
--     .eq('id', self)
-- and forge the document name that the platform's two name cross-checks
-- compare against:
--
--   * Admin → identity name-mismatch review (src/routes/admin.js
--     /users/:userId/stripe-names) shows legal_name as "ID document" and
--     computes namesMatch(display_name, legal_name) for the reviewing admin.
--     A user flagged for a mismatch could set legal_name to match their display
--     name so the panel reports a clean match, steering the admin toward
--     approving the Verified badge on a document that never matched.
--   * connectService's payout-name sync compares the Connect account's KYC'd
--     name against `legal_name || display_name` and maintains
--     payout_name_mismatch from it — a self-set legal_name suppresses that
--     anti-fraud flag.
--
-- is_verified / verification_status / identity_name_mismatch / payout_name_mismatch
-- were already pinned, so this was not a direct self-verification — it degraded
-- the human review that those flags exist to trigger. Pin legal_name the same
-- way, so only the service-role identity flow can set it.
--
-- Legitimate writers are unaffected: admins take the EXISTS(is_admin) branch,
-- and the Stripe Identity sync runs with the service role (RLS bypassed).
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
      -- Newly locked: the ID-document name behind both name cross-checks.
      AND (NOT (legal_name IS DISTINCT FROM ( SELECT p.legal_name FROM profiles p WHERE (p.id = (select auth.uid())))))
    )
  );
