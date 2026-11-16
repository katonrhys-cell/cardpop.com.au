#!/usr/bin/env bash
# Applies 20261116005126_membership_two_yearly_plans.sql (Hobby / Pro /
# Ultimate, and Calendar Spotlight for Ultimate organisers) to a throwaway
# Postgres database on top of the event organiser review stub, the paid
# featuring migration (event_feature_purchases) and the plan stub, then runs
# the behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-membership-plans-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="membership_plans_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_review_stub_schema.sql
run supabase/migrations/20261109235618_event_organiser_review_flow.sql
run supabase/migrations/20261110104532_event_feature_purchases.sql
run tests/db/membership_plans_stub_schema.sql
run supabase/migrations/20261116005126_membership_two_yearly_plans.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261116005126_membership_two_yearly_plans.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/membership_plans.test.sql
