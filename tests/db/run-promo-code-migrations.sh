#!/usr/bin/env bash
# Applies the promo-code migration to a throwaway Postgres database on top of a
# stub of the tables it references, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-promo-code-migrations.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="promo_code_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/promo_codes_stub_schema.sql
run supabase/migrations/20261002131905_create_promo_codes.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261002131905_create_promo_codes.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/promo_codes.test.sql
