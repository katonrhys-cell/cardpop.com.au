#!/usr/bin/env bash
# Applies 20261119092859_event_review_deals_done.sql (event_reviews.deals_done
# + public_event_review_stats()) to a throwaway Postgres database on top of the
# event_reviews migrations it builds on, twice (it must be re-runnable), then
# runs the behavioural checks.
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tests/db/run-event-review-deals-done-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="event_review_deals_done_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_review_deals_done_stub_schema.sql
for f in 20261009213329_event_reviews 20261027070258_event_review_video 20261104090000_event_review_videos_and_deals; do
  run "supabase/migrations/$f.sql"
done
run supabase/migrations/20261119092859_event_review_deals_done.sql
run supabase/migrations/20261119092859_event_review_deals_done.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/event_review_deals_done.test.sql
echo "event review deals done migration: ok"
