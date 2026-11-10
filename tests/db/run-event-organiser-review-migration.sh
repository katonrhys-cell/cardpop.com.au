#!/usr/bin/env bash
# Applies the event organiser review migrations (20261109235618, 20261110002320, 20261110020313, 20261110020314) to a throwaway Postgres
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
run supabase/migrations/20261110002320_event_organiser_offers_and_admin_alerts.sql
run supabase/migrations/20261110020313_event_status_draft.sql
run supabase/migrations/20261110020314_event_organiser_drafts.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261109235618_event_organiser_review_flow.sql
run supabase/migrations/20261110002320_event_organiser_offers_and_admin_alerts.sql
run supabase/migrations/20261110020313_event_status_draft.sql
run supabase/migrations/20261110020314_event_organiser_drafts.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_organiser_review.test.sql
