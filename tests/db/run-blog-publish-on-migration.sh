#!/usr/bin/env bash
# Applies the blog_articles.publish_on migration to a throwaway Postgres
# database on top of a stub blog_articles table and checks the schedule rules.
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tests/db/run-blog-publish-on-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
MIGRATION=$(ls supabase/migrations/*_blog_articles_publish_on.sql)
DB="blog_publish_on_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "create table public.blog_articles (id uuid primary key, slug text, is_published boolean not null default false, published_at timestamptz)"
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run "$MIGRATION"
# Re-applying must be a no-op (db push can re-run a straggler).
run "$MIGRATION"
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/blog_publish_on.test.sql
