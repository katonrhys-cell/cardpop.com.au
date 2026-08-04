-- Restore public.profiles.email — the backend's only way to reach users by mail.
--
-- Server-side code reads a user's login email from profiles.email in many
-- places: order receipts and item-sold emails (stripeWebhookService), refund
-- emails (refundService), identity-review alerts (identityService), the admin
-- user-emails endpoint (routes/admin.js), and the per-admin recipient list for
-- "new order" alert emails (adminNotificationRecipient). The current schema has
-- NO email column on profiles, so every one of those selects fails with
-- undefined_column — and because supabase-js resolves errors instead of
-- throwing, each caller silently proceeds with a null email and the message is
-- never sent. (routes/admin.js even documents the intended design: "profiles.email
-- is deliberately not client-readable (no column grant)" — the column the
-- comment refers to doesn't exist in this schema generation.)
--
-- This adds the column, backfills it from auth.users (the source of truth),
-- records it at signup via handle_new_user(), and keeps it in sync when a user
-- changes their login email.
--
-- Privacy: 20260715210000 replaced the blanket SELECT grant on profiles with an
-- explicit column list for anon/authenticated, so a newly added column is NOT
-- client-readable unless granted — email is deliberately left out of the grant,
-- keeping it service-role/backend only. Self-writes are pinned in the
-- profiles_update_access policy below so a user can't point their profile at an
-- arbitrary address; the sync trigger (SECURITY DEFINER, and service role
-- bypasses RLS) remains the only writer.

alter table public.profiles add column if not exists email text;

-- Backfill every existing profile from auth.users.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- Record the email when the profile row is first created. Identical to the
-- 20260712010000 hardened definition, plus the email column in the insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  base_username text;
  candidate     text;
  suffix        int := 0;
begin
  -- A guaranteed non-null, non-empty base, in order of preference:
  --   explicit username -> email local part -> alphanumeric of full name -> 'user'
  base_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'full_name', '')), '[^a-z0-9]+', '', 'g'), ''),
    'user'
  );

  -- Resolve UNIQUE collisions by appending -1, -2, ... until a free name is found.
  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '-' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, email)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      candidate
    ),
    new.email
  );
  return new;
end;
$function$;

-- Keep profiles.email current when the user changes (or, for OAuth signups
-- that arrived without one, first gains) their login email.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- Pin email against self-writes: same policy as 20260802060200 with email
-- added to the immutable-column list. Admins and the service role are
-- unaffected (admin branch / RLS bypass).
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
      AND (NOT (subscription_tier IS DISTINCT FROM ( SELECT p.subscription_tier FROM profiles p WHERE (p.id = (select auth.uid())))))
      -- Newly locked: the login email mirrored from auth.users.
      AND (NOT (email IS DISTINCT FROM ( SELECT p.email FROM profiles p WHERE (p.id = (select auth.uid())))))
    )
  );
