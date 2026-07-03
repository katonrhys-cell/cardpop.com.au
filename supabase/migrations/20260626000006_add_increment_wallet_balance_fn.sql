-- Atomic wallet-balance adjustment for seller payouts and chargeback clawbacks.
--
-- Previously payoutService.creditWallet and disputeService's clawback read
-- profiles.wallet_balance_aud into JS and wrote it back (read-modify-write).
-- Concurrent payouts (or a payout racing a clawback) overwrite each other,
-- losing or duplicating credited funds. This function performs the adjustment
-- atomically in a single UPDATE so concurrent calls compose correctly.
--
-- A positive p_delta credits the wallet; a negative p_delta claws back. The
-- balance is floored at 0 (matching the previous Math.max(0, …) clawback
-- behaviour) so a clawback can never drive a wallet negative.

create or replace function public.increment_wallet_balance(p_user uuid, p_delta numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set wallet_balance_aud = greatest(0, coalesce(wallet_balance_aud, 0) + p_delta)
   where id = p_user
  returning wallet_balance_aud;
$$;

-- SECURITY DEFINER bypasses RLS, so — like decrement_shop_stock — this must not
-- be callable by anon/authenticated via /rest/v1/rpc. Only the Stripe webhook
-- (service role key) invokes it.
revoke execute on function public.increment_wallet_balance(uuid, numeric) from public;
revoke execute on function public.increment_wallet_balance(uuid, numeric) from anon;
revoke execute on function public.increment_wallet_balance(uuid, numeric) from authenticated;
