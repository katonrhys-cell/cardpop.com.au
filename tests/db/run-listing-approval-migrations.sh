#!/usr/bin/env bash
# Applies the listing-approval migrations to a throwaway Postgres database on
# top of a stub schema, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-listing-approval-migrations.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="listing_approval_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/listing_approval_stub_schema.sql
run supabase/migrations/20260709084111_enforce_listing_approval.sql
run supabase/migrations/20261002082700_enforce_listing_approval_on_update.sql
# Re-applying must be a no-op.
run supabase/migrations/20261002082700_enforce_listing_approval_on_update.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/listing_approval.test.sql
