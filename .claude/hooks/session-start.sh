#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Each web session starts from a fresh clone with no node_modules, so tests,
# linters and the build can't run until dependencies are installed. This hook
# installs them up front. It runs synchronously so nothing in the session races
# ahead of a half-installed tree.
set -euo pipefail

# Only needed in the remote (web) environment — local clones manage their own
# dependencies and shouldn't have a session hook reinstalling on every start.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Informational: the project prefers Node 24 (.nvmrc) but supports >=22. If Node
# is older than 22, engine-strict in .npmrc makes the npm install below stop
# with a clear message rather than failing later in a confusing way.
echo "[session-start] Node $(node --version), npm $(npm --version)" 1>&2

# `npm ci` (not `npm install`) installs the EXACT versions from the committed
# package-lock.json and never rewrites it — so a session can't silently drift a
# dependency. Each web session is a fresh clone, so there's no warm node_modules
# for `npm install` to shortcut anyway. Output to stderr so the install logs
# don't get injected into the session context.
npm ci --no-audit --no-fund 1>&2

echo "[session-start] dependencies ready" 1>&2
