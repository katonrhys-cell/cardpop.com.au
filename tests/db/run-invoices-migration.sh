#!/usr/bin/env bash
# Applies the order-invoices migration to a throwaway Postgres database on top
# of a stub of the tables it references, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-invoices-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="invoices_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/invoices_stub_schema.sql
run supabase/migrations/20261102074307_order_invoices.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261102074307_order_invoices.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/invoices.test.sql
