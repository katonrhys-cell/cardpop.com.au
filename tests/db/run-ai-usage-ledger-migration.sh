#!/usr/bin/env bash
# Applies the AI usage ledger migration to a throwaway Postgres database twice
# (db push can re-run a straggler), then checks the summary function, the
# 18-month prune in the daily housekeeping job, and that browser roles can't
# touch the ledger.
#
#   PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-ai-usage-ledger-migration.sh
#
# Needs a Postgres 15+ server you can create databases on. Not part of
# `npm test` (CI has no Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="ai_usage_ledger_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/db/ai_usage_ledger_stub_schema.sql
run supabase/migrations/20261105210211_ai_usage_ledger.sql
run supabase/migrations/20261105210211_ai_usage_ledger.sql
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/ai_usage_ledger.test.sql
