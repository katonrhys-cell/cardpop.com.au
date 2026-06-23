-- Security fix: lock down execute access on the decrement_shop_stock SECURITY DEFINER function.
--
-- Supabase Security Advisor flagged that public.decrement_shop_stock is callable by the
-- anon and authenticated roles via /rest/v1/rpc/decrement_shop_stock. Because the function
-- is SECURITY DEFINER it bypasses RLS, so any visitor could arbitrarily decrement the
-- stock_quantity of any shop product (inventory manipulation / DoS).
--
-- The function is only ever invoked by the Stripe webhook in src/routes/stripe.js using the
-- service role key, which bypasses these grants, so revoking public access does not affect
-- the legitimate call path.

revoke execute on function public.decrement_shop_stock(uuid, integer) from public;
revoke execute on function public.decrement_shop_stock(uuid, integer) from anon;
revoke execute on function public.decrement_shop_stock(uuid, integer) from authenticated;
