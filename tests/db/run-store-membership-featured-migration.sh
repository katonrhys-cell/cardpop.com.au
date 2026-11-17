#!/usr/bin/env bash
# Applies the featured-shops migration (local_game_stores.membership_featured,
# maintained by triggers from the owner's Ultimate membership) on top of the
# store-pages and shop-ownership migrations in a throwaway Postgres database,
# then checks the flag follows the membership and can't be set by hand.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-store-membership-featured-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="store_membership_featured_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/store_pages_stub_schema.sql
run supabase/migrations/20261114212757_store_pages_media.sql
run tests/db/store_owner_requests_stub_schema.sql
run supabase/migrations/20261116221914_store_owner_requests.sql
# The plan column, and a member who is already Ultimate and owns a shop.
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
alter table public.profiles add column if not exists subscription_tier text not null default 'free';
update public.profiles set subscription_tier = 'ultimate' where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
update public.local_game_stores set owner_id = '00000000-0000-0000-0000-00000000000b' where slug = 'swap-itt-melbourne';
SQL
run supabase/migrations/20261117111555_store_membership_featured.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261117111555_store_membership_featured.sql
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/store_membership_featured.test.sql
