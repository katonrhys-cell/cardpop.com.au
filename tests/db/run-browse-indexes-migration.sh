#!/usr/bin/env bash
# Applies the browse-indexes migration to a throwaway Postgres database on top
# of a stub carrying the production indexes it replaces, twice (re-applying must
# be a no-op), then checks the resulting index set and the points trigger.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-browse-indexes-migration.sh
#
# Needs a Postgres 15+ server with pg_trgm available. Not part of `npm test`
# (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="browse_indexes_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/browse_indexes_stub_schema.sql
run supabase/migrations/20261010020702_browse_indexes_and_trigger_scope.sql
run supabase/migrations/20261010020702_browse_indexes_and_trigger_scope.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/browse_indexes.test.sql
