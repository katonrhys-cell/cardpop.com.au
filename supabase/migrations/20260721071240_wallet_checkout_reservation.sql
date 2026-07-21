-- Atomic single-flight reservation for wallet-funded checkouts
-- (SECURITY_AUDIT_2026-07-21 → M6).
--
-- The wallet balance lives on the Stripe Customer, and a wallet coupon is sized
-- from a live balance read at checkout-session creation but only debited when
-- the completion webhook fires. walletService.assertNoOpenWalletCheckout refuses
-- a new wallet checkout while one is already OPEN in Stripe, which closes the
-- sequential (multi-tab) exploit — but a sub-second concurrent race (two
-- sessions created before either is listable as "open") slips through, letting a
-- buyer apply the same balance to two coupons and over-redeem.
--
-- Close that race with a per-user reservation claimed by an atomic compare-and-
-- swap (Postgres row locking serialises concurrent calls, exactly like the
-- welcome-offer reservation in 20260715250000). The backend reserves before
-- reading the balance and releases at completion / expiry / on failure; a TTL
-- reclaims a reservation whose release webhook was missed so a buyer can never
-- be locked out permanently.
--
-- All access is via the service-role backend, so RLS is enabled with no policy
-- (deny-all to anon/authenticated) and the helper functions' EXECUTE is revoked
-- from the API roles.

create table if not exists public.wallet_checkout_reservations (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  reserved_at timestamptz not null default now()
);

alter table public.wallet_checkout_reservations enable row level security;

-- Atomically acquire the user's wallet-checkout slot. Returns true iff acquired
-- (fresh, or reclaimed because the prior reservation is older than the TTL).
-- A single INSERT ... ON CONFLICT DO UPDATE ... WHERE is atomic under the unique
-- (primary key) constraint, so two concurrent callers can't both acquire.
create or replace function public.reserve_wallet_checkout(
  p_user_id uuid,
  p_ttl_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired boolean := false;
begin
  insert into public.wallet_checkout_reservations (user_id, reserved_at)
  values (p_user_id, now())
  on conflict (user_id) do update
    set reserved_at = now()
    where public.wallet_checkout_reservations.reserved_at
          < now() - make_interval(secs => p_ttl_seconds)
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

-- Release the user's wallet-checkout slot (idempotent).
create or replace function public.release_wallet_checkout(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.wallet_checkout_reservations where user_id = p_user_id;
$$;

-- Only the service-role backend calls these; revoke from the API roles (also
-- clears the SECURITY DEFINER advisor lint) and grant explicitly to service_role
-- so the backend keeps EXECUTE regardless of default-privilege assumptions.
revoke all on function public.reserve_wallet_checkout(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_wallet_checkout(uuid) from public, anon, authenticated;
grant execute on function public.reserve_wallet_checkout(uuid, integer) to service_role;
grant execute on function public.release_wallet_checkout(uuid) to service_role;
