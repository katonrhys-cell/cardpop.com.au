#!/usr/bin/env bash
# Applies the storefront privacy migration to a throwaway Postgres database
# twice (db push can re-run a straggler), then checks who can read and write
# ABNs and business contact details.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-storefront-private-details-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="storefront_private_details_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/storefront_private_details_stub_schema.sql
run supabase/migrations/20261105105904_storefront_private_details.sql
run supabase/migrations/20261105105904_storefront_private_details.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/storefront_private_details.test.sql
