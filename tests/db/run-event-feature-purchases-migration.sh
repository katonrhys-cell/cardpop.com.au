#!/usr/bin/env bash
# Applies the paid event featuring migrations (20261110104532, 20261110124303) to a throwaway
# Postgres database on top of the event organiser review stub (which supplies
# events, profiles, notification_type and event_caller_is_admin()), then runs
# the behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-event-feature-purchases-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_feature_purchases_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_review_stub_schema.sql
run supabase/migrations/20261109235618_event_organiser_review_flow.sql
run supabase/migrations/20261110104532_event_feature_purchases.sql
run supabase/migrations/20261110124303_event_homepage_featured.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261110104532_event_feature_purchases.sql
run supabase/migrations/20261110124303_event_homepage_featured.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_feature_purchases.test.sql
