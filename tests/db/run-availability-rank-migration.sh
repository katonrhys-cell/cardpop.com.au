#!/usr/bin/env bash
# Applies the shop_products.availability_rank migration to a throwaway Postgres
# database on top of a stub of the shop table, then checks the generated tier
# against availability() in utils/shopFacets.js and the default grid order.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-availability-rank-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="availability_rank_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/availability_rank_stub_schema.sql
run supabase/migrations/20261029204324_shop_products_availability_rank.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261029204324_shop_products_availability_rank.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/availability_rank.test.sql
