-- Fix: the selling gate was still enforcing the retired subscription rule, so
-- verified sellers with a card on file could not list anything.
--
-- How the two copies of can_sell() drifted apart:
--
--   20260708205423_lockdown_advisor_flagged_functions.sql moved the function out
--   of the PostgREST-exposed `public` schema into `private` (so it could not be
--   probed via /rest/v1/rpc), repointed the RESTRICTIVE policy
--   `listings_require_selling_entitlement` at `private.can_sell()`, and DROPPED
--   `public.can_sell()`. At that moment the body was the subscription rule:
--   subscription_status in ('trialing','active','grandfathered') or a live trial.
--
--   20260719150000_can_sell_requires_identity_and_reset_plans.sql and
--   20260719160000_require_card_on_file_to_sell.sql then rewrote the gate for the
--   new Hobby/Pro pricing model — any account may sell once it is identity
--   verified and has a card on file. But both used
--   `create or replace function public.can_sell(...)`, which RE-CREATED the
--   dropped public copy instead of updating the `private` one the policy actually
--   calls. So the new logic landed in a function nothing references, while the
--   live gate kept enforcing the old subscription rule.
--
--   Worse, 20260719150000 also retired subscription_status 'grandfathered' to
--   'none'. That removed the last value that made the stale rule true, so the
--   gate began denying essentially every seller: an identity-verified user with a
--   saved card on the free Hobby plan fails `private.can_sell()` outright. The
--   insert into `listings` is denied with 42501 and the UI reports "NOT live yet
--   — selling requires identity verification and a card on file" even though both
--   are already done.
--
-- This migration makes `private.can_sell()` — the one the policy calls — match
-- the intended rule, and removes the re-created `public.can_sell()` so the
-- advisor exposure closed in 20260708205423 does not silently come back. The
-- policy itself is unchanged and keeps working.

-- ── The real gate: identity verification AND a card on file ──────────────────
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
      and coalesce(p.is_verified, false) = true
      and coalesce(p.has_saved_card, false) = true
  );
$$;

-- `create or replace` preserves grants, but re-assert them so this migration is
-- self-contained (matches 20260708205423).
revoke all    on function private.can_sell(uuid) from public;
revoke all    on function private.can_sell(uuid) from anon;
grant  execute on function private.can_sell(uuid) to authenticated, service_role;

-- ── Remove the orphaned public copy ──────────────────────────────────────────
-- Re-created by the two 20260719 migrations. Nothing references it: the RLS
-- policy calls the private one and the frontend derives entitlement in JS from
-- the loaded profile (AuthContext `canSell`), so it is only an unnecessary
-- SECURITY DEFINER function reachable at /rest/v1/rpc/can_sell.
drop function if exists public.can_sell(uuid);
