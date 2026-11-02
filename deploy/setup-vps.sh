#!/usr/bin/env bash
# One-time bootstrap of a fresh Ubuntu 24.04 VPS for CardPop. Run as root:
#
#   curl -fsSL https://raw.githubusercontent.com/katonrhys-cell/cardpop.com.au/main/deploy/setup-vps.sh -o setup-vps.sh
#   ADMIN_IP=203.0.113.7 bash setup-vps.sh        # ADMIN_IP optional: lock SSH to it
#
# (The repository is private, so copy the script over with scp if the raw URL
# needs a token.) What it does, and why — full runbook in docs/vultr-rollout.md:
#
#   • installs Docker (official repo) + compose plugin, git, ufw, fail2ban,
#     unattended-upgrades
#   • adds a 2 GB swapfile when the box has under 4 GB of RAM (the Vite build
#     peaks around 2–3 GB)
#   • creates the `cardpop` user that owns /opt/cardpop and runs the containers,
#     with an SSH deploy key for GitHub (printed at the end — add it to the
#     repository as a read-only Deploy Key) and an authorized key for the
#     deploy workflow (DEPLOY_PUBKEY, or paste it in later)
#   • firewall: deny inbound by default, SSH open (to ADMIN_IP if given),
#     80/443 from Cloudflare's ranges only (deploy/cloudflare-firewall.sh,
#     refreshed weekly by cron)
#   • clones the repository to /opt/cardpop/app and leaves .env + the Origin CA
#     certificate for you to fill in
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

REPO_SSH="${REPO_SSH:-git@github.com:katonrhys-cell/cardpop.com.au.git}"
APP_USER=cardpop
BASE=/opt/cardpop
APP_DIR="$BASE/app"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git ufw fail2ban unattended-upgrades python3

# ── Docker ───────────────────────────────────────────────────────────────────
if ! command -v docker > /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# ── Swap (the Vite build needs headroom on a small box) ──────────────────────
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [[ $mem_kb -lt 4000000 && ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "added a 2 GB swapfile"
fi

# ── App user ─────────────────────────────────────────────────────────────────
if ! id "$APP_USER" > /dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$APP_USER"
fi
usermod -aG docker "$APP_USER"
mkdir -p "$BASE" "$BASE/logs"
chown -R "$APP_USER:$APP_USER" "$BASE"

su - "$APP_USER" -c '
  set -e
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  [[ -f ~/.ssh/github_deploy ]] || ssh-keygen -t ed25519 -N "" -C "cardpop-vps-deploy-key" -f ~/.ssh/github_deploy > /dev/null
  grep -q "Host github.com" ~/.ssh/config 2>/dev/null || printf "Host github.com\n  IdentityFile ~/.ssh/github_deploy\n  IdentitiesOnly yes\n" >> ~/.ssh/config
  ssh-keyscan -t ed25519 github.com 2>/dev/null >> ~/.ssh/known_hosts
  sort -u ~/.ssh/known_hosts -o ~/.ssh/known_hosts
  touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
'
if [[ -n "${DEPLOY_PUBKEY:-}" ]]; then
  echo "$DEPLOY_PUBKEY" >> "/home/$APP_USER/.ssh/authorized_keys"
fi

# ── Firewall ─────────────────────────────────────────────────────────────────
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

# ── Repository ───────────────────────────────────────────────────────────────
if [[ ! -d "$APP_DIR/.git" ]]; then
  echo
  echo "Add this read-only Deploy Key to the GitHub repository (Settings → Deploy keys),"
  echo "then press Enter to clone:"
  echo
  cat "/home/$APP_USER/.ssh/github_deploy.pub"
  echo
  read -r -p "Press Enter once the key is added… " _
  su - "$APP_USER" -c "git clone --quiet '$REPO_SSH' '$APP_DIR'"
fi

su - "$APP_USER" -c "
  cd '$APP_DIR'
  [[ -f .env ]] || { cp .env.example .env && chmod 600 .env; }
  mkdir -p deploy/certs
"

# Cloudflare-only on 80/443, refreshed weekly.
install -m 0755 "$APP_DIR/deploy/cloudflare-firewall.sh" /usr/local/sbin/cardpop-cloudflare-firewall
/usr/local/sbin/cardpop-cloudflare-firewall
printf '#!/bin/sh\n/usr/local/sbin/cardpop-cloudflare-firewall > /dev/null 2>&1\n' > /etc/cron.weekly/cardpop-cloudflare-firewall
chmod 0755 /etc/cron.weekly/cardpop-cloudflare-firewall

cat <<MSG

Done. Next:

  1. Fill in $APP_DIR/.env (as $APP_USER) — every variable in CLAUDE.md →
     Deployment, plus DEPLOY_ALERT_EMAIL for deploy-failure emails.
  2. Put the Cloudflare Origin CA certificate at
       $APP_DIR/deploy/certs/origin.pem
       $APP_DIR/deploy/certs/origin.key      (chmod 600)
     Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate
     (hosts: cardpop.com.au, *.cardpop.com.au).
  3. First deploy:  su - $APP_USER -c '$APP_DIR/deploy/deploy.sh'
  4. For the GitHub deploy workflow, add the workflow's public key to
     /home/$APP_USER/.ssh/authorized_keys and set the VPS_* repository
     secrets — see docs/vultr-rollout.md.
MSG
