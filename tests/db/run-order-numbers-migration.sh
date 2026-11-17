#!/usr/bin/env bash
# Applies the sequential-order-numbers migration to a throwaway Postgres database
# on top of a stub `orders` table that already holds out-of-order rows, then runs
# behavioural checks (every check raises, so a failure exits non-zero).
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-order-numbers-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="order_numbers_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/order_numbers_stub_schema.sql
run supabase/migrations/20261117101216_sequential_order_numbers.sql
# Re-applying must be a no-op (db push can re-run a straggler): no renumbering.
run supabase/migrations/20261117101216_sequential_order_numbers.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/order_numbers.test.sql
