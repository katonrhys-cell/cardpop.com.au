#!/usr/bin/env bash
# Applies the shop pre-order migration to a throwaway Postgres database on top
# of a stub of the shop schema, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-preorder-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres); run it whenever the pre-order migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="preorder_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/preorder_stub_schema.sql
run supabase/migrations/20260922205927_shop_products_coming_soon_status.sql
run supabase/migrations/20261002000345_shop_products_preorder_status.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261002000345_shop_products_preorder_status.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/preorder_status.test.sql
