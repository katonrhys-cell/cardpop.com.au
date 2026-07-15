-- Restrict column-level SELECT on public.profiles.
--
-- The SELECT policy on profiles is "Public profiles are viewable by everyone"
-- (FOR SELECT USING (true)) — appropriate for a marketplace where seller/user
-- profiles are public. But RLS is ROW-level, not column-level, so USING(true)
-- exposes EVERY column of every row to the anon key that ships in the frontend
-- bundle. 20260706202906_lock_profile_financial_columns.sql locked these
-- columns against WRITES but nothing restricted READS, so any visitor could:
--   supabase.from('profiles').select('wallet_balance_aud, stripe_customer_id, ...')
-- and harvest every user's wallet balance and Stripe/PayPal customer identifiers.
--
-- Fix: keep the row policy, but gate reads with Postgres column privileges
-- (PostgREST honours them). Revoke the blanket table SELECT from the API roles
-- and re-grant SELECT only on the non-sensitive columns. The six omitted columns
-- (wallet_balance_aud, stripe_customer_id, stripe_subscription_id,
-- paypal_subscription_id, stripe_identity_session_id, legal_name) are financial
-- or identity secrets that the browser never reads — the wallet UI reads the
-- balance from the backend (/wallet connect status), and the Stripe/PayPal/
-- identity ids and legal name are used only by service-role backend code.
--
-- service_role is unaffected (revoke targets only anon/authenticated), so the
-- backend keeps full read access. The frontend column allow-list is mirrored in
-- lib/profileColumns.js — keep the two in sync.
--
-- NOTE: after this lands, `select('*')` on profiles from the browser fails with
-- "permission denied for column"; all client reads must enumerate columns
-- (done in the accompanying frontend change).

revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  location_state,
  location_suburb,
  community_type,
  seller_tier,
  is_verified,
  is_admin,
  total_sales,
  total_purchases,
  positive_feedback_pct,
  join_date,
  interest_categories,
  user_type,
  onboarding_done,
  created_at,
  updated_at,
  mfa_enabled,
  is_featured_seller,
  is_active,
  verification_status,
  rating,
  reviews_count,
  response_time,
  successful_sales,
  social_links,
  looking_for,
  is_public,
  profile_photo_or_character,
  name,
  is_sole_trader,
  business_name,
  business_tagline,
  abn,
  business_logo_url,
  business_categories,
  dealer_trust_badges,
  dealer_shipping_policy,
  store_slug,
  subscription_status,
  subscription_provider,
  trial_ends_at,
  subscription_tier,
  verified_at,
  is_deleted,
  personal_collection
) on public.profiles to anon, authenticated;
