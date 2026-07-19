// Explicit allow-list of the `public.profiles` columns that anon/authenticated
// clients may read. It deliberately EXCLUDES the six "crown jewel" columns that
// are financial or identity secrets and are never read by the browser:
//   wallet_balance_aud, stripe_customer_id, stripe_subscription_id,
//   paypal_subscription_id, stripe_identity_session_id, legal_name
//
// The database enforces this via column-level SELECT grants (see migration
// 20260715210000_restrict_profiles_sensitive_column_reads.sql). Because those
// grants make `select('*')` fail with "permission denied for column", every
// frontend read of profiles (direct or embedded) must enumerate its columns.
// Import this constant so the client column list always matches the grant.
//
// Note: these are the columns the CLIENT may read. Server-side code uses the
// service-role key, which bypasses these grants and can still read every column.
export const PUBLIC_PROFILE_COLUMNS = [
  'id',
  'username',
  'display_name',
  'avatar_url',
  'bio',
  'location_state',
  'location_suburb',
  'community_type',
  'seller_tier',
  'is_verified',
  'is_admin',
  'total_sales',
  'total_purchases',
  'positive_feedback_pct',
  'join_date',
  'interest_categories',
  'user_type',
  'onboarding_done',
  'created_at',
  'updated_at',
  'mfa_enabled',
  'is_featured_seller',
  'is_active',
  'verification_status',
  'rating',
  'reviews_count',
  'response_time',
  'successful_sales',
  'social_links',
  'looking_for',
  'is_public',
  'profile_photo_or_character',
  'name',
  'is_sole_trader',
  'business_name',
  'business_tagline',
  'abn',
  'business_logo_url',
  'business_categories',
  'dealer_trust_badges',
  'dealer_shipping_policy',
  'store_slug',
  'subscription_status',
  'subscription_provider',
  'trial_ends_at',
  'subscription_tier',
  'has_saved_card',
  'verified_at',
  'is_deleted',
  'personal_collection',
].join(',');
