#!/usr/bin/env bash
# Applies the event-views migration to a throwaway Postgres database on top of
# a stub of the Supabase pieces, then runs the behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-event-views-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_views_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_views_stub_schema.sql
run supabase/migrations/20261111003031_event_page_views.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261111003031_event_page_views.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_views.test.sql
