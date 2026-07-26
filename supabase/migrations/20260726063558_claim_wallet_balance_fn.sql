-- Atomically claim (zero out) a seller's held wallet balance for withdrawal.
--
-- Proceeds accumulate in profiles.wallet_balance_aud whenever a sale completes
-- while the seller has no onboarded Stripe Connect account. Once they connect,
-- the /stripe/connect/withdraw endpoint pays that held balance out — but the
-- read-then-transfer-then-zero sequence would race with a concurrent sale
-- credit (increment_wallet_balance), either paying out stale amounts or losing
-- a credit. This function claims the exact current balance and zeroes it in
-- one row-locked transaction; the caller transfers the returned amount and
-- re-credits it (increment_wallet_balance with a positive delta) if the Stripe
-- transfer fails.
--
-- Returns the claimed amount (0 if there was nothing to claim).

create or replace function public.claim_wallet_balance(p_user uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
begin
  select coalesce(wallet_balance_aud, 0) into v_amount
    from public.profiles
   where id = p_user
     for update;

  if v_amount is null or v_amount <= 0 then
    return 0;
  end if;

  update public.profiles
     set wallet_balance_aud = 0
   where id = p_user;

  return v_amount;
end;
$$;

-- SECURITY DEFINER bypasses RLS — like increment_wallet_balance, only the
-- backend (service role key) may call it, never anon/authenticated via
-- /rest/v1/rpc.
revoke execute on function public.claim_wallet_balance(uuid) from public;
revoke execute on function public.claim_wallet_balance(uuid) from anon;
revoke execute on function public.claim_wallet_balance(uuid) from authenticated;
