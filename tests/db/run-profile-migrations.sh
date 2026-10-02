#!/usr/bin/env bash
# Applies the profiles update-policy fix to a throwaway Postgres database on top
# of a stub of the production profiles table, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-profile-migrations.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="profiles_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/profiles_stub_schema.sql
# The stub reproduces the bug before the fix lands.
before=$(psql -X -q -d "$DB" -c "begin; set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b'; set local role authenticated; update public.profiles set bio = 'x' where id = auth.uid(); rollback;" 2>&1 || true)
if grep -q 'permission denied for table profiles' <<<"$before"; then
  echo "stub reproduces: permission denied for table profiles"
else
  echo "stub did NOT reproduce the pre-fix failure" >&2; exit 1
fi
run supabase/migrations/20261002081506_fix_profiles_update_policy_column_grants.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261002081506_fix_profiles_update_policy_column_grants.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/profiles_update_policy.test.sql
