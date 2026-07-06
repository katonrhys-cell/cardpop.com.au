# Stripe Sync Engine

The `stripe` schema in the Supabase project is populated by Supabase's **Stripe Sync Engine** integration (Dashboard → Integrations → Stripe Wrapper), enabled with a restricted, read-only Stripe API key stored in Vault. It is not the plain Wrappers FDW (no live per-query API calls) — it's a background sync job that writes real Postgres tables, one per Stripe object (`stripe.customers`, `stripe.subscriptions`, `stripe.charges`, `stripe.invoices`, `stripe.disputes`, `stripe.refunds`, `stripe.accounts`, `stripe.payment_intents`, `stripe.checkout_sessions`, `stripe.products`, `stripe.prices`, etc.), each with a `_raw_data jsonb` column holding the full object and a handful of internal bookkeeping tables (`stripe._migrations`, `stripe._sync_runs`, `stripe._sync_obj_runs`, `stripe._managed_webhooks`, `stripe._rate_limits`).

## Ownership

**The integration owns this schema, not this repo.** It manages its own schema versioning (tracked in `stripe._migrations`) and keeps tables in sync via its own webhook/polling process. `supabase/migrations/` must never `create table`/`alter table` anything under `stripe.*` — that would collide with the sync engine's internal migration tracking. Anything the sync engine adds in a future schema upgrade shows up automatically without a repo migration.

The only thing this repo's migrations touch is **access control** on top of that schema (see `20260706212946_grant_stripe_sync_schema_access.sql`):
- `service_role` has `SELECT` on the schema and all its tables (plus `default privileges` so new tables the sync engine creates later inherit the same grant automatically).
- `anon` and `authenticated` have no access at all.

## Why it's locked down

This data isn't meant to be reachable from the frontend or through RLS-based access:
- `stripe` is **not** in `config.toml`'s exposed `api.schemas` (`["public", "graphql_public"]`), so it has no PostgREST/Supabase-JS surface by default.
- Even if it were exposed, `anon`/`authenticated` have zero grants, so a request would still get `permission denied`.

To actually query it from the Express backend (`src/utils/supabaseClient.js`), the project's exposed schemas would need `stripe` added via Dashboard → Project Settings → API → Data API settings — that's a project-level setting, not something `supabase db push` controls, so it has to be done by hand if/when a feature needs it. Until then, use the Supabase SQL Editor (or the `execute_sql`-style MCP tool) for ad-hoc reporting queries.

## What it replaces (nothing, yet)

This is purely for read-only reporting/reconciliation against live Stripe data. It does not replace:
- `src/services/stripeWebhookService.js` — still the source of truth for real-time app logic (order fulfillment, wallet balance updates, etc.).
- `profiles.stripe_customer_id` — still the link between a CardPop user and their Stripe Customer.

There is no application code reading from the `stripe` schema yet.
