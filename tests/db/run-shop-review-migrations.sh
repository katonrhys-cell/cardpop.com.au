#!/usr/bin/env bash
# Applies the shop product review migration to a throwaway Postgres database on
# top of a stub of the tables it references, then runs behavioural checks.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-shop-review-migrations.sh
#
# Not part of `npm test` (CI has no Postgres); run it whenever the migration changes.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="shop_review_migration_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/shop_reviews_stub_schema.sql
run supabase/migrations/20261003060100_shop_product_reviews.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261003060100_shop_product_reviews.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/shop_reviews.test.sql
