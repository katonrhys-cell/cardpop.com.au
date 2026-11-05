#!/usr/bin/env bash
# Applies the blog_articles published_at migration to a throwaway Postgres
# database on top of a stub of the table, then checks the backfill and the
# trigger (publish stamps a date; re-publish and backdates keep theirs).
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-blog-published-at-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="blog_published_at_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/blog_published_at_stub_schema.sql
run supabase/migrations/20261105105257_blog_articles_stamp_published_at.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261105105257_blog_articles_stamp_published_at.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/blog_published_at.test.sql
