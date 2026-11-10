#!/usr/bin/env bash
# Applies 20261110221128_event_sold_out_waitlist.sql (sold out, waitlist link,
# booking fee) to a throwaway Postgres database on top of the event organiser
# stub schema and migrations, twice (it must be re-runnable), then runs the
# behavioural checks.
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tests/db/run-event-sold-out-waitlist-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_sold_out_waitlist_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_review_stub_schema.sql
# The stub predates this column; events_public (recreated by the migration) lists it.
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "alter table public.events add column if not exists homepage_featured boolean not null default false"
for f in 20261109235618_event_organiser_review_flow 20261110002320_event_organiser_offers_and_admin_alerts \
         20261110020313_event_status_draft 20261110020314_event_organiser_drafts; do
  run "supabase/migrations/$f.sql"
done
run supabase/migrations/20261110221128_event_sold_out_waitlist.sql
run supabase/migrations/20261110221128_event_sold_out_waitlist.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_sold_out_waitlist.test.sql
echo "event sold out / waitlist / booking fee migration: ok"
