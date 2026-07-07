-- Hardening: sync_admin_app_metadata() is a SECURITY DEFINER TRIGGER function
-- that mirrors profiles.is_admin into auth.users.raw_app_meta_data. It only ever
-- needs to run as a trigger (which executes as the table owner, independent of
-- the caller's EXECUTE privilege), yet PostgREST exposed EXECUTE to anon +
-- authenticated (Supabase linter 0028/0029). Calling a trigger function directly
-- via /rpc has no NEW record so it errors — not exploitable — but there is no
-- reason for the public roles to hold EXECUTE. Revoke it.
--
-- Idempotent: REVOKE is a no-op if the grant is already absent.

revoke execute on function public.sync_admin_app_metadata() from anon, authenticated, public;
