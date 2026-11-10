#!/usr/bin/env bash
# Reproduces the event-submission failure (missing 'event_pending_review'
# enum value) and checks 20261106061312_admin_review_notification_types.sql
# fixes it, on a throwaway database.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-admin-review-notifications-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of `npm test`.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="admin_review_notif_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/admin_review_notifications_stub_schema.sql
run supabase/migrations/20260731113046_notify_admins_on_event_submission.sql
run tests/db/admin_review_notifications_before.test.sql
run supabase/migrations/20261106061312_admin_review_notification_types.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261106061312_admin_review_notification_types.sql
run tests/db/admin_review_notifications.test.sql
echo "admin review notification migration: all checks passed"
