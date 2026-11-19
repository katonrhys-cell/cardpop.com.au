#!/usr/bin/env bash
# Applies 20261119050236_close_private_data_gaps.sql to a throwaway Postgres on
# top of a stub of the affected objects, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-private-data-gaps-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres). SKIP_MIGRATION=1 shows the checks failing on
# the pre-migration schema.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="private_data_gaps_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/private_data_gaps_stub_schema.sql
if [ "${SKIP_MIGRATION:-}" != "1" ]; then
  run supabase/migrations/20261119050236_close_private_data_gaps.sql
  # Re-applying must be a no-op (db push can re-run a straggler).
  run supabase/migrations/20261119050236_close_private_data_gaps.sql
fi
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/private_data_gaps.test.sql
