#!/usr/bin/env bash
# Applies 20261119000153_event_vendor_info.sql (events.vendor_info) to a
# throwaway Postgres database on top of the event organiser stub schema and the
# migrations it builds on, twice (it must be re-runnable), then runs the
# behavioural checks.
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tests/db/run-event-vendor-info-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_vendor_info_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_review_stub_schema.sql
# The stub predates this column; events_public (recreated by the migrations) lists it.
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "alter table public.events add column if not exists homepage_featured boolean not null default false"
for f in 20261109235618_event_organiser_review_flow 20261110002320_event_organiser_offers_and_admin_alerts \
         20261110020313_event_status_draft 20261110020314_event_organiser_drafts \
         20261110221128_event_sold_out_waitlist 20261111092216_event_side_events_and_prizes; do
  run "supabase/migrations/$f.sql"
done
run supabase/migrations/20261119000153_event_vendor_info.sql
run supabase/migrations/20261119000153_event_vendor_info.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_vendor_info.test.sql
echo "event vendor info migration: ok"
