#!/usr/bin/env bash
# Applies the organiser social-links migration (20261116110000) and the
# organiser-messages migration (20261116120000) to a throwaway Postgres
# database, on top of the real event_organisers migrations and a stub of the
# Supabase pieces, then runs the behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-organiser-messages-migration.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever either migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="organiser_messages_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/event_organiser_requests_stub_schema.sql
run supabase/migrations/20261102093000_event_organisers_directory.sql
run supabase/migrations/20261110224209_event_organiser_requests.sql
run supabase/migrations/20261116110000_organiser_tiktok_x_linktree_links.sql
run supabase/migrations/20261116120000_organiser_messages.sql
run supabase/migrations/20261118233912_organiser_contact_url.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261116110000_organiser_tiktok_x_linktree_links.sql
run supabase/migrations/20261116120000_organiser_messages.sql
run supabase/migrations/20261118233912_organiser_contact_url.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/organiser_messages.test.sql
