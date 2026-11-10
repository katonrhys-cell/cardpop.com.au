#!/usr/bin/env bash
# Applies 20261110203544_close_direct_write_gaps.sql to a throwaway Postgres on
# top of a stub of the affected tables, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-direct-write-gaps-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres); run it whenever that migration, or a policy
# on refunds / seller_ratings / vault_items / listings / trades, changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="direct_write_gaps_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/direct_write_gaps_stub_schema.sql
if [ "${SKIP_MIGRATION:-}" != "1" ]; then
  run supabase/migrations/20261110203544_close_direct_write_gaps.sql
  # Re-applying must be a no-op (db push can re-run a straggler).
  run supabase/migrations/20261110203544_close_direct_write_gaps.sql
fi
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/direct_write_gaps.test.sql
