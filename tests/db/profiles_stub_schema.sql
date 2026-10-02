-- Minimal stand-in for public.profiles as it is in production (checked
-- 2026-10-02): every column, the column-level SELECT grants from
-- 20260715210000 / 20260720120000, and the profiles_update_access policy as
-- last defined in 20260804023016. Enum-typed columns are text here.
-- Used by tests/db/run-profile-migrations.sh only.
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create table public.profiles (
  id uuid primary key, username text, display_name text, avatar_url text, bio text,
  location_state text, location_suburb text, community_type text, seller_tier text,
  is_verified boolean, is_admin boolean default false, total_sales integer, total_purchases integer,
  positive_feedback_pct numeric(5,2), join_date date, interest_categories text[], user_type text,
  onboarding_done boolean, created_at timestamptz, updated_at timestamptz, mfa_enabled boolean,
  is_featured_seller boolean, is_active boolean, verification_status text, rating numeric(3,2),
  reviews_count integer, response_time text, successful_sales integer, social_links jsonb,
  looking_for text, is_public boolean, profile_photo_or_character text, name text,
  is_sole_trader boolean, business_name text, business_tagline text, abn text,
  business_logo_url text, business_categories text[], dealer_trust_badges text[],
  dealer_shipping_policy text, store_slug text, subscription_status text,
  subscription_provider text, trial_ends_at timestamptz, stripe_customer_id text,
  stripe_subscription_id text, paypal_subscription_id text, wallet_balance_aud numeric(12,2),
  subscription_tier text, stripe_identity_session_id text, legal_name text,
  verified_at timestamptz, is_deleted boolean, personal_collection text,
  identity_name_mismatch boolean, payout_name_mismatch boolean, has_saved_card boolean,
  stripe_connect_account_id text, stripe_connect_onboarded boolean, email text
);
alter table public.profiles enable row level security;
grant all on public.profiles to anon, authenticated, service_role;

-- 20260715210000 + 20260720120000: no client SELECT on the sensitive columns.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, username, display_name, avatar_url, bio, location_state, location_suburb,
  community_type, seller_tier, is_verified, is_admin, total_sales, total_purchases,
  positive_feedback_pct, join_date, interest_categories, user_type, onboarding_done,
  created_at, updated_at, mfa_enabled, is_featured_seller, is_active,
  verification_status, rating, reviews_count, response_time, successful_sales,
  social_links, looking_for, is_public, profile_photo_or_character, name,
  is_sole_trader, business_name, business_tagline, abn, business_logo_url,
  business_categories, dealer_trust_badges, dealer_shipping_policy, store_slug,
  subscription_status, subscription_provider, trial_ends_at, subscription_tier,
  verified_at, is_deleted, personal_collection, has_saved_card
) on public.profiles to anon, authenticated;

create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);
-- The pre-fix policy (20260804023016): pins read via caller-privileged subqueries.
create policy profiles_update_access on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true) or (select auth.uid()) = id)
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true) or ((select auth.uid()) = id
    and not (is_admin is distinct from (select p.is_admin from public.profiles p where p.id = (select auth.uid())))
    and not (is_verified is distinct from (select p.is_verified from public.profiles p where p.id = (select auth.uid())))
    and not (seller_tier is distinct from (select p.seller_tier from public.profiles p where p.id = (select auth.uid())))
    and not (total_sales is distinct from (select p.total_sales from public.profiles p where p.id = (select auth.uid())))
    and not (total_purchases is distinct from (select p.total_purchases from public.profiles p where p.id = (select auth.uid())))
    and not (verification_status is distinct from (select p.verification_status from public.profiles p where p.id = (select auth.uid())))
    and not (wallet_balance_aud is distinct from (select p.wallet_balance_aud from public.profiles p where p.id = (select auth.uid())))
    and not (subscription_status is distinct from (select p.subscription_status from public.profiles p where p.id = (select auth.uid())))
    and not (subscription_provider is distinct from (select p.subscription_provider from public.profiles p where p.id = (select auth.uid())))
    and not (trial_ends_at is distinct from (select p.trial_ends_at from public.profiles p where p.id = (select auth.uid())))
    and not (stripe_customer_id is distinct from (select p.stripe_customer_id from public.profiles p where p.id = (select auth.uid())))
    and not (stripe_subscription_id is distinct from (select p.stripe_subscription_id from public.profiles p where p.id = (select auth.uid())))
    and not (paypal_subscription_id is distinct from (select p.paypal_subscription_id from public.profiles p where p.id = (select auth.uid())))
    and not (stripe_identity_session_id is distinct from (select p.stripe_identity_session_id from public.profiles p where p.id = (select auth.uid())))
    and not (identity_name_mismatch is distinct from (select p.identity_name_mismatch from public.profiles p where p.id = (select auth.uid())))
    and not (payout_name_mismatch is distinct from (select p.payout_name_mismatch from public.profiles p where p.id = (select auth.uid())))
    and not (rating is distinct from (select p.rating from public.profiles p where p.id = (select auth.uid())))
    and not (positive_feedback_pct is distinct from (select p.positive_feedback_pct from public.profiles p where p.id = (select auth.uid())))
    and not (reviews_count is distinct from (select p.reviews_count from public.profiles p where p.id = (select auth.uid())))
    and not (successful_sales is distinct from (select p.successful_sales from public.profiles p where p.id = (select auth.uid())))
    and not (is_featured_seller is distinct from (select p.is_featured_seller from public.profiles p where p.id = (select auth.uid())))
    and not (has_saved_card is distinct from (select p.has_saved_card from public.profiles p where p.id = (select auth.uid())))
    and not (stripe_connect_account_id is distinct from (select p.stripe_connect_account_id from public.profiles p where p.id = (select auth.uid())))
    and not (stripe_connect_onboarded is distinct from (select p.stripe_connect_onboarded from public.profiles p where p.id = (select auth.uid())))
    and not (legal_name is distinct from (select p.legal_name from public.profiles p where p.id = (select auth.uid())))
    and not (subscription_tier is distinct from (select p.subscription_tier from public.profiles p where p.id = (select auth.uid())))
    and not (email is distinct from (select p.email from public.profiles p where p.id = (select auth.uid())))
  ));

insert into public.profiles (id, username, display_name, is_admin, wallet_balance_aud, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', true, 0, 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'user', 'User', false, 5, 'u@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'other', 'Other', false, 7, 'o@example.com');
