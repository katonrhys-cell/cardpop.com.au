#!/usr/bin/env bash
# One-time bootstrap of a small Ubuntu 24.04 VPS as CardPop's self-hosted
# GitHub Actions runner. Run as root:
#
#   scp deploy/setup-runner.sh root@<runner-ip>:
#   ssh root@<runner-ip> 'RUNNER_TOKEN=<token> ADMIN_IP=<your-ip> bash setup-runner.sh'
#
# RUNNER_TOKEN is the registration token GitHub shows at
#   repo → Settings → Actions → Runners → New self-hosted runner → Linux
# (the value after `--token`). It is valid for one hour and is NOT a secret
# that lives anywhere afterwards — the runner exchanges it for its own
# credential during config.sh. ADMIN_IP is optional and locks SSH to it.
#
# Why this exists: a private repository bills every GitHub Actions run a whole
# metered minute, and the PR gate (lint + tests + build, ~4 min) plus the
# Playwright E2E run (~10 min) exhausted the 2,000-minute allowance once,
# which stopped every workflow including the migration push. Jobs on a
# self-hosted runner are free. This box runs ONLY CI — never the site; CI
# executes pull-request code, and it must not share a kernel with Stripe
# webhooks. Runbook: docs/ci-runner.md.
#
# What it does:
#   • installs git, Node 24 (NodeSource), the AWS CLI (the E2E job uploads its
#     report to S3 on failure) and Playwright's Chromium system libraries, so
#     the workflows never need sudo on the box
#   • adds a 2 GB swapfile under 4 GB of RAM (the Vite build peaks at 2–3 GB)
#   • creates the unprivileged `runner` user, installs the latest
#     actions/runner release under /opt/actions-runner, registers it with the
#     labels in RUNNER_LABELS and runs it as a systemd service
#   • firewall: deny inbound, SSH only (the runner needs outbound only)
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
[[ -n "${RUNNER_TOKEN:-}" ]] || { echo "RUNNER_TOKEN is required (repo → Settings → Actions → Runners → New self-hosted runner)" >&2; exit 1; }

REPO_URL="${REPO_URL:-https://github.com/katonrhys-cell/cardpop.com.au}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)}"
# The workflows select this box with these labels (CI_RUNS_ON repo variable).
RUNNER_LABELS="${RUNNER_LABELS:-cardpop-ci}"
RUNNER_DIR=/opt/actions-runner
RUNNER_USER=runner
NODE_MAJOR="${NODE_MAJOR:-24}"
# Playwright's system libraries are stable across versions; any recent one
# installs the set Chromium needs. Keep it near the repo's @playwright/test.
PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.61.1}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git jq unzip ufw fail2ban unattended-upgrades

# ── Node ─────────────────────────────────────────────────────────────────────
if ! command -v node > /dev/null || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -q nodejs
fi
echo "node $(node -v), npm $(npm -v)"

# ── Playwright system libraries (so the E2E job needs no sudo) ───────────────
npx --yes "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium

# ── AWS CLI v2 (E2E failure reports go to S3 via OIDC) ───────────────────────
if ! command -v aws > /dev/null; then
  tmp=$(mktemp -d)
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "$tmp/awscliv2.zip"
  unzip -q "$tmp/awscliv2.zip" -d "$tmp"
  "$tmp/aws/install" > /dev/null
  rm -rf "$tmp"
fi

# ── Swap ─────────────────────────────────────────────────────────────────────
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [[ $mem_kb -lt 4000000 && ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "added a 2 GB swapfile"
fi

# ── Firewall: outbound only, plus SSH ────────────────────────────────────────
ufw --force reset > /dev/null
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
if [[ -n "${ADMIN_IP:-}" ]]; then
  ufw allow from "$ADMIN_IP" to any port 22 proto tcp comment admin-ssh > /dev/null
else
  ufw limit 22/tcp comment ssh > /dev/null
fi
ufw --force enable > /dev/null
systemctl enable --now fail2ban

# ── Runner user + the actions/runner release ─────────────────────────────────
id "$RUNNER_USER" > /dev/null 2>&1 || useradd --create-home --shell /bin/bash "$RUNNER_USER"
mkdir -p "$RUNNER_DIR"
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"

if [[ ! -x "$RUNNER_DIR/config.sh" ]]; then
  version=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r '.tag_name' | sed 's/^v//')
  [[ -n "$version" && "$version" != null ]] || { echo "could not resolve the latest actions/runner version" >&2; exit 1; }
  tarball="actions-runner-linux-x64-${version}.tar.gz"
  echo "installing actions/runner ${version}"
  curl -fsSL -o "/tmp/$tarball" "https://github.com/actions/runner/releases/download/v${version}/${tarball}"
  # The release page publishes the archive's SHA-256 in its notes; verify it.
  expected=$(curl -fsSL "https://api.github.com/repos/actions/runner/releases/tags/v${version}" | jq -r '.body' | grep -oE "[a-f0-9]{64}" | head -1 || true)
  if [[ -n "$expected" ]]; then
    echo "$expected  /tmp/$tarball" | sha256sum -c - > /dev/null || { echo "runner tarball checksum mismatch" >&2; exit 1; }
  else
    echo "WARNING: could not read the published checksum; continuing with the HTTPS download"
  fi
  tar -xzf "/tmp/$tarball" -C "$RUNNER_DIR"
  rm -f "/tmp/$tarball"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"
fi

# Register (idempotent: --replace re-registers a runner of the same name).
su - "$RUNNER_USER" -c "cd '$RUNNER_DIR' && ./config.sh --unattended --replace \
  --url '$REPO_URL' --token '$RUNNER_TOKEN' --name '$RUNNER_NAME' \
  --labels '$RUNNER_LABELS' --work _work"

# Run it as a systemd service (actions.runner.<owner-repo>.<name>.service).
(cd "$RUNNER_DIR" && ./svc.sh install "$RUNNER_USER" > /dev/null && ./svc.sh start > /dev/null)
(cd "$RUNNER_DIR" && ./svc.sh status | head -5)

# Keep the box tidy: a job's temp files and the npm cache grow without bound.
cat > /etc/cron.weekly/cardpop-runner-tidy <<'CRON'
#!/bin/sh
rm -rf /opt/actions-runner/_work/_temp/* 2>/dev/null
su - runner -c 'npm cache verify > /dev/null 2>&1' || true
CRON
chmod 0755 /etc/cron.weekly/cardpop-runner-tidy

cat <<MSG

Done. The runner "$RUNNER_NAME" (labels: self-hosted, linux, x64, $RUNNER_LABELS)
should now show as Idle at $REPO_URL/settings/actions/runners.

Next: point the heavy workflows at it with ONE repository variable —
  repo → Settings → Secrets and variables → Actions → Variables → New:
    Name:  CI_RUNS_ON
    Value: ["self-hosted","linux","x64","$RUNNER_LABELS"]
Delete the variable to fall back to GitHub-hosted runners (docs/ci-runner.md).
MSG
