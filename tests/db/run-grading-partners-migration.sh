#!/usr/bin/env bash
# Applies the grading submission partners migration to a throwaway Postgres
# database on top of a stub of the production schema, then runs behavioural
# checks: the seed, re-run idempotence, constraints, updated_at and RLS.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-grading-partners-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="grading_partners_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/grading_partners_stub_schema.sql
run supabase/migrations/20261104192816_grading_submission_partners.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261104192816_grading_submission_partners.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/grading_partners.test.sql
