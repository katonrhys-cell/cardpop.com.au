-- Two more Stripe name cross-checks, following the identity_name_mismatch
-- pattern (20260719004700):
--
-- 1. profiles.payout_name_mismatch — the seller's Stripe Connect payout
--    account carries a KYC'd legal name (verified by Stripe before payouts
--    are enabled). connectService compares it against the profile's
--    ID-verified legal_name (falling back to display_name) whenever the
--    Connect status is synced, and flags a difference: "the person who passed
--    the ID check isn't the person receiving the money". Informational — it
--    surfaces in the admin user management section and auto-clears when the
--    names agree on a later sync.
--
-- 2. orders.payer_name_mismatch — the name the buyer typed at Stripe Checkout
--    (customer_details.name, NOT verified by Stripe) compared against the
--    buyer's account name at order-confirmation time. Stored per order, null
--    when unknown (guest checkout, no name captured). Deliberately
--    informational-only: paying with a partner's or work card is common, so
--    this must never gate anything — the admin order detail just shows a note.
--
-- payout_name_mismatch stays service-role-only (the per-column SELECT grants
-- from 20260715210000 mean new profiles columns are unreadable by clients
-- unless granted) and is appended to the self-update policy's immutable list.
-- orders.payer_name_mismatch is written only by the service-role webhook and
-- readable through the existing orders policies (buyer/seller/admin) — it's
-- low-sensitivity information about the reader's own order.

alter table public.profiles
  add column if not exists payout_name_mismatch boolean not null default false;

alter table public.orders
  add column if not exists payer_name_mismatch boolean;

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
    and not (payout_name_mismatch is distinct from (select p.payout_name_mismatch from public.profiles p where p.id = auth.uid()))
  );
