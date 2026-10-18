#!/usr/bin/env bash
# Applies the players migration to a throwaway Postgres database on top of a
# stub of the production schema, then runs behavioural checks: the seed, the
# tracker backfill, RLS, constraints and the vault_items link.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-players-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="players_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/players_stub_schema.sql
run supabase/migrations/20261018020526_players.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261018020526_players.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/players.test.sql
