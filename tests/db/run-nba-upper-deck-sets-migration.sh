#!/usr/bin/env bash
# Applies the NBA → Upper Deck sets migration to a throwaway Postgres database
# seeded with the live Upper Deck rows (as of 2026-10-18), twice, then checks
# the relabels, the flagship renames and the inserted sets.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-nba-upper-deck-sets-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="ud_sets_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/nba_upper_deck_sets_stub_schema.sql
run supabase/migrations/20261018085328_nba_upper_deck_sets.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261018085328_nba_upper_deck_sets.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/nba_upper_deck_sets.test.sql
