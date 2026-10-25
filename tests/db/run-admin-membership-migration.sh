#!/usr/bin/env bash
# Applies 20261023032430_admins_hold_complimentary_ultimate.sql to a throwaway
# Postgres database on top of the production profiles stub, then checks that
# admin access grants (and demotion revokes) the complimentary Ultimate plan.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-admin-membership-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="admin_membership_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/profiles_stub_schema.sql
# The stub's admin row starts with no plan at all — the pre-migration state.
run tests/db/admin_membership_seed.sql
run supabase/migrations/20261023032430_admins_hold_complimentary_ultimate.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261023032430_admins_hold_complimentary_ultimate.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/admin_membership.test.sql
