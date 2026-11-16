#!/usr/bin/env bash
# Applies the shop-ownership migration (local_game_stores.owner_id, the owner
# update policy + guard trigger, store_owner_requests, the owner upload policy)
# on top of the store-pages migration in a throwaway Postgres database, then
# checks what an owner, a stranger and an admin can each do.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-store-owner-requests-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="store_owner_requests_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/store_pages_stub_schema.sql
run supabase/migrations/20261114212757_store_pages_media.sql
run tests/db/store_owner_requests_stub_schema.sql
run supabase/migrations/20261116221914_store_owner_requests.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261116221914_store_owner_requests.sql
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/store_owner_requests.test.sql
