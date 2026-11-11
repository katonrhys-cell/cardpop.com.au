#!/usr/bin/env bash
# Applies the organiser-requests migration (20261110224209) to a throwaway
# Postgres database on top of the real event_organisers directory migration and a stub of the
# Supabase pieces, then runs the behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-event-organiser-requests-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_organiser_requests_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_requests_stub_schema.sql
run supabase/migrations/20261102093000_event_organisers_directory.sql
run supabase/migrations/20261110224209_event_organiser_requests.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261110224209_event_organiser_requests.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_organiser_requests.test.sql
