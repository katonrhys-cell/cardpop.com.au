-- Resolve Supabase Security Advisor warnings on SECURITY DEFINER functions that
-- are reachable via PostgREST (/rest/v1/rpc/...).
--
-- Root cause: Supabase's default privileges grant EXECUTE on every new function
-- in `public` to anon, authenticated AND service_role. The earlier migrations
-- for these functions only did `revoke all ... from public`, which strips the
-- PUBLIC grant but NOT those explicit per-role grants — so anon/authenticated
-- kept EXECUTE and the advisor flagged them (lints 0028 / 0029). Lock each
-- function down to the role that actually calls it.

-- 1. increment_partner_clicks — called only by the backend (service_role) from
--    partnerService.recordPartnerClick(); anon/authenticated never call it.
--    Clears both the anon (0028) and authenticated (0029) warnings.
revoke execute on function public.increment_partner_clicks(text) from anon;
revoke execute on function public.increment_partner_clicks(text) from authenticated;

-- 2. accept_trade — called client-side by signed-in users
--    (hooks/useTradeRequests.js), so `authenticated` must keep EXECUTE, but a
--    trade acceptance always requires signing in, so anon never calls it.
--    Clears the anon (0028) warning. The remaining authenticated (0029) warning
--    is by design: this function must stay SECURITY DEFINER so its cross-user
--    "cancel competing proposed trades" sweep can update rows the caller does
--    not own — SECURITY INVOKER would break that under RLS.
revoke execute on function public.accept_trade(uuid, uuid) from anon;

-- 3. can_sell — never called through the API. It exists only to be referenced
--    inside the listings_require_selling_entitlement RLS policy, which is
--    evaluated as the querying (authenticated) role. Move it out of the
--    PostgREST-exposed `public` schema into a private schema so it is
--    unreachable via /rest/v1/rpc while the policy keeps working. Clears the
--    authenticated (0029) warning.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.can_sell(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and (
        p.subscription_status in ('trialing', 'active', 'grandfathered')
        or (p.trial_ends_at is not null and p.trial_ends_at > now())
      )
  );
$$;

revoke all on function private.can_sell(uuid) from public;
revoke all on function private.can_sell(uuid) from anon;
grant execute on function private.can_sell(uuid) to authenticated, service_role;

-- Repoint the selling gate at the relocated function, then drop the exposed copy.
drop policy if exists listings_require_selling_entitlement on public.listings;
create policy listings_require_selling_entitlement
  on public.listings
  as restrictive
  for insert
  to authenticated
  with check (private.can_sell(auth.uid()));

drop function if exists public.can_sell(uuid);
