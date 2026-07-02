-- Security fix: lock down execute access on the can_sell SECURITY DEFINER function.
--
-- Supabase Security Advisor flagged that public.can_sell(uuid) is callable by the anon
-- role via /rest/v1/rpc/can_sell. Postgres grants EXECUTE to PUBLIC by default when a
-- function is created, and the original migration (20260701000001_add_subscription_trial)
-- never revoked that default grant — so despite the explicit `grant ... to authenticated`,
-- the PUBLIC grant left the function open to anon.
--
-- Because can_sell is SECURITY DEFINER it bypasses RLS on public.profiles, so an
-- unauthenticated visitor could probe the seller entitlement (subscription/trial state) of
-- any user id via the RPC endpoint.
--
-- The function is only legitimately used inside the `listings_require_selling_entitlement`
-- RLS policy on public.listings, which is scoped `to authenticated`. That policy expression
-- is evaluated as the querying role, so the `authenticated` role must retain EXECUTE for the
-- selling gate to keep working. The frontend never calls this RPC directly — AuthContext /
-- SellingGate derive entitlement in JS from the loaded profile — so anon needs no access.
--
-- Net effect: revoke the default PUBLIC/anon grant, keep authenticated.

revoke execute on function public.can_sell(uuid) from public;
revoke execute on function public.can_sell(uuid) from anon;
grant execute on function public.can_sell(uuid) to authenticated;
