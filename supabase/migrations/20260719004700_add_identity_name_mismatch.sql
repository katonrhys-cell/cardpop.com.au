-- Flag Stripe Identity verifications whose document name doesn't match the
-- profile's display name (the name given at signup). Set server-side by
-- identityService.applyIdentitySession: on a mismatch the verification is NOT
-- auto-approved — it stays 'pending' with this flag on, and an admin resolves
-- it from the user management section (/admin/users) via
-- PATCH /admin/users/:userId/identity-review.
--
-- Deliberately NOT granted to anon/authenticated:
-- 20260715210000_restrict_profiles_sensitive_column_reads.sql revoked the
-- blanket SELECT on profiles and re-granted per column, so a new column is
-- unreadable by clients unless granted here. The admin UI reads it through the
-- service-role backend (GET /admin/users/identity-mismatches), keeping the
-- moderation signal off the public profile surface.

alter table public.profiles
  add column if not exists identity_name_mismatch boolean not null default false;

-- Also lock the flag against self-editing. The self-update policy allows
-- column writes unless the column is in its immutable list (clients can't
-- read the flag, but a blind UPDATE would still go through) — recreate the
-- policy with identity_name_mismatch appended, same shape as
-- 20260706202906_lock_profile_financial_columns.sql.

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
    and not (identity_name_mismatch is distinct from (select p.identity_name_mismatch from public.profiles p where p.id = auth.uid()))
  );
