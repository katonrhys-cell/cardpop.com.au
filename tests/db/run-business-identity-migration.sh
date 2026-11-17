#!/usr/bin/env bash
# Applies the business_identity() migration to a throwaway Postgres database
# on top of a stub settings table and checks what anon can (and can't) read.
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tests/db/run-business-identity-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="business_identity_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/shop_shipping_terms_stub_schema.sql
run supabase/migrations/20261117092815_business_identity_rpc.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261117092815_business_identity_rpc.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/business_identity.test.sql
