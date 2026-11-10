#!/usr/bin/env bash
# Applies the event organiser review migration to a throwaway Postgres
# database on top of a stub of the tables it references, then runs the
# behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-event-organiser-review-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_organiser_review_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_review_stub_schema.sql
run supabase/migrations/20261109235618_event_organiser_review_flow.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261109235618_event_organiser_review_flow.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_organiser_review.test.sql
