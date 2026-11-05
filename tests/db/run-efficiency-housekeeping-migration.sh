#!/usr/bin/env bash
# Applies the efficiency housekeeping migration to a throwaway Postgres
# database on top of the vault and rate-limit stubs, twice (db push can re-run
# a straggler), then checks: the vault_images policies still give everyone the
# same access, stale rate-limit keys are pruned, and the indexes land.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-efficiency-housekeeping-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. pg_cron isn't
# required: the cron parts of the migration are guarded and skip without it.
# Not part of `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="efficiency_housekeeping_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/vault_publicly_listed_stub_schema.sql
run supabase/migrations/20261010020701_vault_publicly_listed.sql
run tests/db/efficiency_housekeeping_stub_schema.sql
run supabase/migrations/20260721072719_rate_limit_counters.sql
run supabase/migrations/20261105070414_efficiency_housekeeping.sql
run supabase/migrations/20261105070414_efficiency_housekeeping.sql
# Visibility must be exactly what the publicly_listed test already expects.
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/vault_publicly_listed.test.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/efficiency_housekeeping.test.sql
