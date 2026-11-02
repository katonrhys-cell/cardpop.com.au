#!/usr/bin/env bash
# Deploy CardPop on the VPS: fetch main (or a given commit), rebuild the app
# image, swap the container, prune. Runs as the `cardpop` user from the
# checkout at /opt/cardpop/app. Runbook: docs/vultr-rollout.md.
#
#   deploy/deploy.sh                 deploy origin/main
#   deploy/deploy.sh <sha>           deploy that exact commit
#   deploy/deploy.sh --detach [sha]  return at once; the deploy runs in the
#                                    background and logs to logs/deploy.log
#                                    (what .github/workflows/deploy.yml calls,
#                                    so the Actions job bills seconds, not the
#                                    minutes the build takes)
#
# Safe to re-run; a second invocation waits for the first (flock). The old
# container keeps serving until the new image has built, and if anything
# fails the old one stays up. On failure an email goes to DEPLOY_ALERT_EMAIL
# through Resend when RESEND_API_KEY is in .env — the same alert path as the
# scheduler Worker, because a deploy nobody saw fail is the worst kind.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cardpop/app}"
LOG_DIR="${LOG_DIR:-$(dirname "$APP_DIR")/logs}"
LOCK_FILE="${LOCK_FILE:-$(dirname "$APP_DIR")/deploy.lock}"
BRANCH="${DEPLOY_BRANCH:-main}"

detach=0
if [[ "${1:-}" == "--detach" ]]; then detach=1; shift; fi
TARGET="${1:-}"

mkdir -p "$LOG_DIR"

if [[ $detach -eq 1 ]]; then
  # Re-run ourselves in the background, fully detached from the SSH session.
  nohup setsid "$0" "$TARGET" >> "$LOG_DIR/deploy.log" 2>&1 < /dev/null &
  echo "deploy started in background (pid $!) — tail $LOG_DIR/deploy.log"
  exit 0
fi

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

alert() {
  # $1 = subject, $2 = body. Best effort, never fails the script.
  local key email from
  key=$(grep -E '^RESEND_API_KEY=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  email=$(grep -E '^DEPLOY_ALERT_EMAIL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  from=$(grep -E '^DEPLOY_ALERT_FROM=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  [[ -n "$key" && -n "$email" ]] || return 0
  curl -sS --max-time 15 https://api.resend.com/emails \
    -H "Authorization: Bearer $key" -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"from": sys.argv[1], "to": [sys.argv[2]], "subject": sys.argv[3], "text": sys.argv[4]}))' \
          "${from:-CardPop Deploy <noreply@cardpop.com.au>}" "$email" "$1" "$2")" > /dev/null || true
}

on_error() {
  local line=$1
  log "FAILED at line $line — the previous container is still serving"
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

cd "$APP_DIR"
[[ -f .env ]] || { log ".env is missing — copy .env.example and fill it in"; exit 1; }
[[ -f deploy/certs/origin.pem && -f deploy/certs/origin.key ]] || log "WARNING: deploy/certs/origin.{pem,key} missing — Caddy will not start until the Origin CA certificate is in place"

log "fetching origin/$BRANCH"
git fetch --quiet origin "$BRANCH"
if [[ -n "$TARGET" ]]; then
  git -c advice.detachedHead=false checkout --quiet --force "$TARGET"
else
  git checkout --quiet --force -B "$BRANCH" "origin/$BRANCH"
fi
log "at $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"

log "building the app image"
DOCKER_BUILDKIT=1 docker compose build --pull app

log "swapping containers"
docker compose up -d --remove-orphans

log "waiting for the app to report healthy"
for _ in $(seq 1 30); do
  status=$(docker inspect --format '{{.State.Health.Status}}' cardpop-app 2>/dev/null || echo starting)
  [[ "$status" == healthy ]] && break
  sleep 2
done
if [[ "$status" != healthy ]]; then
  log "app container is '$status', not healthy — recent logs:"
  docker logs --tail 50 cardpop-app || true
  false
fi

log "pruning dangling images"
docker image prune -f > /dev/null || true

log "deployed $(git rev-parse --short HEAD) OK"
