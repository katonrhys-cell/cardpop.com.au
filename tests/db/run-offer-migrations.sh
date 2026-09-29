#!/usr/bin/env bash
# Applies the offer-related migrations to a throwaway Postgres database on top
# of a stub of the production schema, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-offer-migrations.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres); run it whenever an offers migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="offers_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/offers_stub_schema.sql
run supabase/migrations/20260705024521_expression_of_interest_offers.sql
run supabase/migrations/20260706202907_offers_prevent_price_tamper.sql
run supabase/migrations/20260921210000_offers_bind_seller_to_listing.sql
run supabase/migrations/20260928071118_listings_accept_offers_by_default.sql
run supabase/migrations/20260928071648_binding_offers_lifecycle.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20260928071118_listings_accept_offers_by_default.sql
run supabase/migrations/20260928071648_binding_offers_lifecycle.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/offers_lifecycle.test.sql
