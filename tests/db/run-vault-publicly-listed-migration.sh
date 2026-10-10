#!/usr/bin/env bash
# Applies the vault_items.publicly_listed migration to a throwaway Postgres
# database on top of a stub of the production schema (current policies, lock
# trigger), then runs behavioural checks: the sync trigger, the lock trigger
# rewrite, and who can see which cards and images.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-vault-publicly-listed-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="vault_publicly_listed_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/vault_publicly_listed_stub_schema.sql
run supabase/migrations/20261010020701_vault_publicly_listed.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261010020701_vault_publicly_listed.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/vault_publicly_listed.test.sql
