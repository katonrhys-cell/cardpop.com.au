-- Make shop-stock decrement guarded + observable to prevent silent oversell.
--
-- The original function floored at zero: stock_quantity = greatest(0, stock - qty).
-- Stock is validated at checkout-session creation but only decremented here in
-- the webhook, so two buyers can both pass the check for the last unit, both pay,
-- and the stock silently floors at 0 — the oversell is invisible and both orders
-- confirm. This version only decrements when there is enough stock and returns
-- whether it succeeded, so the caller can flag an oversell for manual resolution
-- instead of confirming it silently.
--
-- The return type changes (void → boolean), so the old function must be dropped
-- first (CREATE OR REPLACE cannot change a function's return type).

drop function if exists public.decrement_shop_stock(uuid, integer);

create function public.decrement_shop_stock(p_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.shop_products
     set stock_quantity = stock_quantity - p_qty,
         updated_at = now()
   where id = p_id
     and stock_quantity >= p_qty;
  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

-- Re-apply the lockdown from 20260623000003: SECURITY DEFINER bypasses RLS, so
-- the function must not be callable by anon/authenticated. Only the Stripe
-- webhook (service role key) invokes it.
revoke execute on function public.decrement_shop_stock(uuid, integer) from public;
revoke execute on function public.decrement_shop_stock(uuid, integer) from anon;
revoke execute on function public.decrement_shop_stock(uuid, integer) from authenticated;
