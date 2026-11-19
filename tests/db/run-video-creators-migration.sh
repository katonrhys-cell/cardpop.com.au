#!/usr/bin/env bash
# Applies the video-creators migration (the saved creators table, its admin-only
# write policies and the trigger that keeps every video's credit in step) to a
# throwaway Postgres database on top of a stub schema, then checks who can
# write, that an edit / delete reaches the credits, and that re-applying is a
# no-op.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-video-creators-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="video_creators_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/video_creators_stub_schema.sql
run supabase/migrations/20261118235054_video_creators.sql
# Re-applying must be a no-op (db push can re-run a straggler).
run supabase/migrations/20261118235054_video_creators.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/video_creators.test.sql
