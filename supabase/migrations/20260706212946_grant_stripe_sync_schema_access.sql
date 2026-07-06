-- Grant the backend (service_role) read access to the `stripe` schema
-- populated by the Stripe Sync Engine integration (enabled via Dashboard >
-- Integrations > Stripe Wrapper). That integration owns its own tables and
-- migrations (tracked in stripe._migrations / stripe._sync_runs) — this repo
-- never creates or alters those tables, only grants read access to them.
-- See docs/stripe-sync.md.

grant usage on schema stripe to service_role;
grant select on all tables in schema stripe to service_role;

-- Tables the sync engine adds in future schema upgrades (it owns them as
-- the `postgres` role, same role migrations run as) also get read access
-- without needing another migration here.
alter default privileges for role postgres in schema stripe
  grant select on tables to service_role;

revoke all on schema stripe from anon, authenticated;
