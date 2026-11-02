#!/usr/bin/env bash
# Deploy CardPop on the VPS. Runs as the `cardpop` user. Runbook: docs/vultr-rollout.md.
#
#   deploy.sh                 deploy origin/main
#   deploy.sh <sha>           deploy that exact commit
#   deploy.sh --detach [sha]  return at once; the deploy runs in the background
#                             and logs to /opt/cardpop/logs/deploy.log (what
#                             .github/workflows/deploy.yml calls, so the Actions
#                             job bills seconds, not the minutes the build takes)
#
# Layout (made by setup-vps.sh):
#   /opt/cardpop/repo/            git clone — only ever fetched
#   /opt/cardpop/releases/<id>/   one directory per deploy: the commit's files,
#                                 node_modules, dist/ — built here, never in place
#   /opt/cardpop/current ->       symlink to the release systemd runs
#   /opt/cardpop/shared/.env      the environment (linked into every release, so
#                                 Vite reads VITE_* at build and dotenv at runtime)
#   /opt/cardpop/shared/certs/    Cloudflare Origin CA certificate + key
#   /opt/cardpop/bin/deploy.sh    this script, refreshed after each deploy
#
# A deploy is: fetch → export the commit into a new release → npm ci → vite
# build → prune dev deps → flip `current` → systemctl restart cardpop → wait
# for /healthz. The running release is untouched until the flip, so a failed
# build changes nothing; a release that doesn't come up healthy is rolled back
# to the previous one. Two deploys never overlap (flock); a failure emails
# DEPLOY_ALERT_EMAIL through Resend when RESEND_API_KEY is in .env.
set -euo pipefail

BASE="${CARDPOP_BASE:-/opt/cardpop}"
REPO="$BASE/repo"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
SHARED="$BASE/shared"
LOG_DIR="$BASE/logs"
LOCK_FILE="$BASE/deploy.lock"
BRANCH="${DEPLOY_BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
HEALTH_URL="${HEALTH_URL:-https://127.0.0.1/healthz}"
SERVICE="${SERVICE:-cardpop}"

detach=0
if [[ "${1:-}" == "--detach" ]]; then detach=1; shift; fi
TARGET="${1:-}"

mkdir -p "$LOG_DIR" "$RELEASES"

if [[ $detach -eq 1 ]]; then
  nohup setsid "$0" "$TARGET" >> "$LOG_DIR/deploy.log" 2>&1 < /dev/null &
  echo "deploy started in background (pid $!) — tail $LOG_DIR/deploy.log"
  exit 0
fi

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

envval() { grep -E "^$1=" "$SHARED/.env" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

alert() {
  # $1 = subject, $2 = body. Best effort; never fails the script.
  local key email from
  key=$(envval RESEND_API_KEY); email=$(envval DEPLOY_ALERT_EMAIL); from=$(envval DEPLOY_ALERT_FROM)
  [[ -n "$key" && -n "$email" ]] || return 0
  curl -sS --max-time 15 https://api.resend.com/emails \
    -H "Authorization: Bearer $key" -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"from": sys.argv[1], "to": [sys.argv[2]], "subject": sys.argv[3], "text": sys.argv[4]}))' \
          "${from:-CardPop Deploy <noreply@cardpop.com.au>}" "$email" "$1" "$2")" > /dev/null || true
}

previous=""
release=""
on_error() {
  local line=$1
  log "FAILED at line $line"
  if [[ -n "$previous" && -L "$CURRENT" && "$(readlink -f "$CURRENT")" == "$(readlink -f "$release")" ]]; then
    log "rolling back to $(basename "$previous")"
    ln -sfn "$previous" "$CURRENT.tmp" && mv -T "$CURRENT.tmp" "$CURRENT"
    sudo systemctl restart "$SERVICE" || true
  else
    log "the running release was not changed"
  fi
  alert "[CardPop] deploy FAILED on $(hostname)" "deploy.sh failed at line $line for target '${TARGET:-$BRANCH}'. Last log lines:
$(tail -n 40 "$LOG_DIR/deploy.log" 2>/dev/null || echo '(no log)')"
  exit 1
}
trap 'on_error $LINENO' ERR

exec 9>"$LOCK_FILE"
if ! flock -w 1800 9; then
  log "could not take the deploy lock within 30 minutes"
  exit 1
fi

[[ -f "$SHARED/.env" ]] || { log "$SHARED/.env is missing — copy .env.example there and fill it in"; exit 1; }
[[ -f "$SHARED/certs/origin.pem" && -f "$SHARED/certs/origin.key" ]] || log "WARNING: $SHARED/certs/origin.{pem,key} missing — the server will refuse to start until the Origin CA certificate is in place"

log "fetching origin/$BRANCH"
git -C "$REPO" fetch --quiet origin "$BRANCH"
sha=$(git -C "$REPO" rev-parse "${TARGET:-origin/$BRANCH}")
release="$RELEASES/$(date -u +%Y%m%d%H%M%S)-${sha:0:7}"
log "deploying $sha → $(basename "$release"): $(git -C "$REPO" log -1 --pretty=%s "$sha")"

mkdir -p "$release"
git -C "$REPO" archive "$sha" | tar -x -C "$release"
ln -sfn "$SHARED/.env" "$release/.env"

log "installing dependencies"
(cd "$release" && npm ci --no-audit --no-fund --loglevel=error)

log "building"
(cd "$release" && NODE_OPTIONS=--max-old-space-size=3072 npm run build)
[[ -f "$release/dist/index.html" && -f "$release/dist/app.html" ]] || { log "build produced no dist/index.html + app.html"; false; }

log "pruning development dependencies"
(cd "$release" && npm prune --omit=dev --no-audit --no-fund --loglevel=error)

if [[ -L "$CURRENT" ]]; then previous=$(readlink -f "$CURRENT"); fi
log "switching current → $(basename "$release")"
ln -sfn "$release" "$CURRENT.tmp" && mv -T "$CURRENT.tmp" "$CURRENT"

log "restarting $SERVICE"
sudo systemctl restart "$SERVICE"

log "waiting for $HEALTH_URL"
healthy=0
for _ in $(seq 1 30); do
  if curl -sk --max-time 3 -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null | grep -q '^200$'; then healthy=1; break; fi
  sleep 2
done
if [[ $healthy -ne 1 ]]; then
  log "server did not become healthy — recent journal:"
  sudo journalctl -u "$SERVICE" -n 40 --no-pager || true
  false
fi

# Keep this script current for the next run, and the last few releases for a
# manual rollback (`ln -sfn <release> current && sudo systemctl restart cardpop`).
mkdir -p "$BASE/bin" && cp "$release/deploy/deploy.sh" "$BASE/bin/deploy.sh" && chmod +x "$BASE/bin/deploy.sh"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [[ "$(readlink -f "$old")" == "$(readlink -f "$CURRENT")" ]] && continue
  rm -rf "$old"
done

log "deployed ${sha:0:7} OK"
