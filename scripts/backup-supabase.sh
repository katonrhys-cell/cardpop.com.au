#!/usr/bin/env bash
#
# Manual full backup of the CardPop Supabase project → one timestamped archive
# you can drag into the "cardpop.com.au- site backup" Google Drive folder.
#
# What it captures:
#   - roles.sql   database roles (ownership/grants)         via `supabase db dump`
#   - schema.sql  full schema (tables, RLS, functions, …)   via `supabase db dump`
#   - data.sql    all row data                              via `supabase db dump`
#   - storage/    every Storage object except the verification-docs bucket
#                 (currently empty — ID checks run through Stripe, not Supabase;
#                 skipped by default as a safe guard). See scripts/backup-storage.mjs
#
# What it does NOT capture (by design):
#   - Application code — already fully versioned on GitHub.
#   - Vercel / Supabase dashboard settings, secrets, OAuth config — recreate
#     these from docs/, they are not in the database.
#
# Prerequisites (one-time):
#   npm i -g supabase              # or use npx supabase ...
#   supabase login
#   supabase link --project-ref vrfsaazuqjxotnieqlkd
#   export SUPABASE_URL=https://vrfsaazuqjxotnieqlkd.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # for the storage half
#
# Usage:
#   ./scripts/backup-supabase.sh                 # DB + public storage buckets
#   INCLUDE_SENSITIVE=1 ./scripts/backup-supabase.sh   # also verification-docs
#
# The database is tiny (~75 MB), so a full run takes well under a minute.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="backups/${STAMP}"
mkdir -p "$WORK"

# supabase CLI: prefer a global install, fall back to npx.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE="supabase"
else
  SUPABASE="npx --yes supabase"
fi

echo "==> Dumping database (roles, schema, data) ..."
$SUPABASE db dump --role-only -f "${WORK}/roles.sql"
$SUPABASE db dump            -f "${WORK}/schema.sql"
$SUPABASE db dump --data-only -f "${WORK}/data.sql"

echo "==> Downloading storage objects ..."
STORAGE_ARGS=(--out "${WORK}/storage")
if [ "${INCLUDE_SENSITIVE:-0}" = "1" ]; then
  STORAGE_ARGS+=(--include-sensitive)
  echo "    (including verification-docs — if it holds anything sensitive, store this archive ENCRYPTED)"
fi
node scripts/backup-storage.mjs "${STORAGE_ARGS[@]}"

echo "==> Writing manifest ..."
cat > "${WORK}/MANIFEST.txt" <<EOF
CardPop Supabase backup
project_ref : vrfsaazuqjxotnieqlkd
created_utc : ${STAMP}
contents    : roles.sql, schema.sql, data.sql, storage/
sensitive   : $([ "${INCLUDE_SENSITIVE:-0}" = "1" ] && echo "verification-docs INCLUDED" || echo "verification-docs excluded")
restore     : see docs/backup-and-restore.md
EOF

ARCHIVE="backups/cardpop-backup-${STAMP}.tar.gz"
echo "==> Creating archive ..."
tar -czf "$ARCHIVE" -C backups "$STAMP"
rm -rf "$WORK"

echo
echo "✅ Backup complete: ${ARCHIVE}"
echo "   Next: upload it to the 'cardpop.com.au- site backup' folder in Google Drive."
if [ "${INCLUDE_SENSITIVE:-0}" = "1" ]; then
  echo "   ⚠  Includes the verification-docs bucket — if it ever holds sensitive"
  echo "      data, encrypt this archive and keep it out of a shared/synced folder."
fi
