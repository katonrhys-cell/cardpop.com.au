#!/usr/bin/env bash
# Applies the store-pages migration (photos / videos / hours on
# local_game_stores, the admin insert policy, the Swap Itt Melbourne seed) to a
# throwaway Postgres database on top of a stub of the table, then checks the
# column grants, the policy and that re-applying is a no-op.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-store-pages-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="store_pages_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/store_pages_stub_schema.sql
run supabase/migrations/20261114212757_store_pages_media.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261114212757_store_pages_media.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/store_pages.test.sql
