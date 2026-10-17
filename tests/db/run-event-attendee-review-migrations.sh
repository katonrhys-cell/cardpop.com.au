#!/usr/bin/env bash
# Applies the past-events / attendee-review migration to a throwaway Postgres
# database on top of a stub of the tables it references, then runs the
# behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-event-attendee-review-migrations.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_attendee_review_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_attendee_reviews_stub_schema.sql
run supabase/migrations/20261017044544_past_events_and_attendee_reviews.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261017044544_past_events_and_attendee_reviews.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_attendee_reviews.test.sql
