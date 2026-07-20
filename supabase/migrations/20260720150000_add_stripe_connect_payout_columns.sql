-- Create the Stripe Connect payout columns the seller-payout flow has always
-- referenced but no migration ever created — in production every read/write of
-- them fails:
--   * profiles.stripe_connect_account_id / stripe_connect_onboarded — read and
--     written by connectService.js (onboarding + status sync), payoutService.js
--     (transfer destination) and partnerService.js (partner commission payouts).
--   * orders.payout_status / stripe_transfer_id — stamped by payoutService.js
--     when proceeds are transferred or wallet-credited, and read by the
--     account Wallet & Payouts page ("Sale Payouts" table), which currently
--     errors with "Could not load your sale payouts".
--
-- payout_status values written by the code: 'pending' (default, not yet paid),
-- 'transferred', 'wallet_credited', 'failed'. Left as text (no enum) so new
-- states don't need a migration.

alter table public.profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_onboarded boolean not null default false;

alter table public.orders
  add column if not exists payout_status text default 'pending',
  add column if not exists stripe_transfer_id text;

-- Reads: profiles SELECT is column-granted (20260715210000), so the two new
-- profiles columns are automatically NOT readable by anon/authenticated — the
-- frontend gets Connect status from the backend (/stripe/connect/status), which
-- uses the service role. No grant needed. orders has a table-level SELECT grant,
-- so buyers/sellers can read their own orders' payout columns via the existing
-- row policies — exactly what the Wallet page needs.

-- Writes: pin the new profiles columns in the self-update branch of
-- profiles_update_access (last recreated in 20260720120200) so a user can't
-- point their payouts at an arbitrary Stripe account or flip themselves to
-- "onboarded" with the anon key. Only the service-role backend writes them.
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
      -- Newly locked: Stripe Connect payout account linkage (service-role only).
      AND (NOT (stripe_connect_account_id IS DISTINCT FROM ( SELECT p.stripe_connect_account_id FROM profiles p WHERE (p.id = (select auth.uid())))))
      AND (NOT (stripe_connect_onboarded IS DISTINCT FROM ( SELECT p.stripe_connect_onboarded FROM profiles p WHERE (p.id = (select auth.uid())))))
    )
  );
