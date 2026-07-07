-- SECURITY FIX (critical): the Stripe Wrapper integration (Dashboard >
-- Integrations > Stripe > "Wrapper", server `stripe_wrapper_server`) creates
-- FOREIGN tables in the `public` schema — accounts, balance,
-- "balance transactions", charges. Foreign tables DO NOT enforce Row Level
-- Security, and as objects in `public` they inherited the schema's default
-- grants to `anon` and `authenticated`. Result: anyone holding the public
-- anon key (which ships in the frontend bundle) could read/write live Stripe
-- account, balance and charge data via PostgREST (`/rest/v1/charges`, etc.),
-- bypassing RLS entirely. Confirmed exposed via the Supabase security linter
-- (0017_foreign_table_in_api) and pg_class.relacl grants.
--
-- Note: this is distinct from 20260706212946_grant_stripe_sync_schema_access.sql,
-- which correctly locked down the separate `stripe` *schema* (Sync Engine).
-- That one was fine; these `public` foreign tables were the leak.
--
-- Fix: revoke all privileges from anon + authenticated on every foreign table
-- in `public`. service_role (used only by the backend with the service-role key)
-- retains access, so backend/admin Stripe analytics are unaffected. Written
-- dynamically so any future wrapper foreign table added to `public` is covered
-- without another migration. Idempotent and safe to re-run.

do $$
declare
  ft record;
begin
  for ft in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'f'            -- foreign tables
      and n.nspname = 'public'
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated',
      ft.schema_name, ft.table_name
    );
  end loop;
end $$;

-- NOTE: we deliberately do NOT touch ALTER DEFAULT PRIVILEGES for the public
-- schema here. Supabase relies on new public tables being granted to anon/
-- authenticated by default (grant + RLS is the normal access model); revoking
-- that default would silently break future legitimate tables. Foreign tables
-- are rare and linter-visible (0017_foreign_table_in_api), so we scope the fix
-- to them explicitly instead.
