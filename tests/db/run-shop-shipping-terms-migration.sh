#!/usr/bin/env bash
# Applies the shop_shipping_terms() migration to a throwaway Postgres database
# on top of a stub settings table and checks what anon can (and can't) read.
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tests/db/run-shop-shipping-terms-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="shop_shipping_terms_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/shop_shipping_terms_stub_schema.sql
run supabase/migrations/20261105090739_shop_shipping_terms_rpc.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261105090739_shop_shipping_terms_rpc.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/shop_shipping_terms.test.sql
