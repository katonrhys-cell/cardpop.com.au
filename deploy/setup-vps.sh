#!/usr/bin/env bash
# One-time bootstrap of a fresh Ubuntu 24.04 VPS for CardPop. Run as root:
#
#   scp deploy/setup-vps.sh root@<vps-ip>:
#   ssh root@<vps-ip> 'ADMIN_IP=<your-ip> bash setup-vps.sh'   # ADMIN_IP optional: lock SSH to it
#
# What it does, and why — full runbook in docs/vultr-rollout.md:
#   • installs Node 24 (NodeSource), git, ufw, fail2ban, unattended-upgrades
#   • adds a 2 GB swapfile when the box has under 4 GB of RAM (the Vite build
#     peaks around 2–3 GB)
#   • creates the `cardpop` user that owns /opt/cardpop and runs the server,
#     with an SSH deploy key for GitHub (printed — add it to the repository as
#     a read-only Deploy Key) and, if DEPLOY_PUBKEY is given, the authorized
#     key for the GitHub deploy workflow
#   • lays out /opt/cardpop/{repo,releases,shared,logs,bin}, installs the
#     systemd unit (deploy/cardpop.service) and the sudo rule that lets
#     `cardpop` restart it
#   • firewall: deny inbound by default, SSH open (to ADMIN_IP if given),
#     80/443 from Cloudflare's ranges only (deploy/cloudflare-firewall.sh,
#     refreshed weekly by cron)
#   • leaves shared/.env and shared/certs/ for you to fill in
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

REPO_SSH="${REPO_SSH:-git@github.com:katonrhys-cell/cardpop.com.au.git}"
NODE_MAJOR="${NODE_MAJOR:-24}"
APP_USER=cardpop
BASE=/opt/cardpop

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git ufw fail2ban unattended-upgrades python3

# ── Node ─────────────────────────────────────────────────────────────────────
if ! command -v node > /dev/null || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -q nodejs
fi
echo "node $(node -v), npm $(npm -v)"

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

# ── App user and layout ──────────────────────────────────────────────────────
id "$APP_USER" > /dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$BASE"/{releases,shared/certs,logs,bin}
chown -R "$APP_USER:$APP_USER" "$BASE"
chmod 700 "$BASE/shared" "$BASE/shared/certs"

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
if [[ ! -d "$BASE/repo/.git" ]]; then
  echo
  echo "Add this read-only Deploy Key to the GitHub repository (Settings → Deploy keys),"
  echo "then press Enter to clone:"
  echo
  cat "/home/$APP_USER/.ssh/github_deploy.pub"
  echo
  read -r -p "Press Enter once the key is added… " _
  su - "$APP_USER" -c "git clone --quiet '$REPO_SSH' '$BASE/repo'"
fi

su - "$APP_USER" -c "
  set -e
  [[ -f '$BASE/shared/.env' ]] || { cp '$BASE/repo/.env.example' '$BASE/shared/.env' && chmod 600 '$BASE/shared/.env'; }
  cp '$BASE/repo/deploy/deploy.sh' '$BASE/bin/deploy.sh' && chmod +x '$BASE/bin/deploy.sh'
"

# ── systemd unit + the one sudo rule the deploy needs ────────────────────────
install -m 0644 "$BASE/repo/deploy/cardpop.service" /etc/systemd/system/cardpop.service
systemctl daemon-reload
systemctl enable cardpop > /dev/null
cat > /etc/sudoers.d/cardpop <<SUDO
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart cardpop, /usr/bin/systemctl status cardpop, /usr/bin/systemctl is-active cardpop, /usr/bin/journalctl -u cardpop *
SUDO
chmod 0440 /etc/sudoers.d/cardpop
visudo -cf /etc/sudoers.d/cardpop > /dev/null

# ── Cloudflare-only on 80/443, refreshed weekly ──────────────────────────────
install -m 0755 "$BASE/repo/deploy/cloudflare-firewall.sh" /usr/local/sbin/cardpop-cloudflare-firewall
/usr/local/sbin/cardpop-cloudflare-firewall
printf '#!/bin/sh\n/usr/local/sbin/cardpop-cloudflare-firewall > /dev/null 2>&1\n' > /etc/cron.weekly/cardpop-cloudflare-firewall
chmod 0755 /etc/cron.weekly/cardpop-cloudflare-firewall

cat <<MSG

Done. Next:

  1. Fill in $BASE/shared/.env (as $APP_USER) — every variable in CLAUDE.md →
     Deployment, plus DEPLOY_ALERT_EMAIL for deploy-failure emails.
  2. Put the Cloudflare Origin CA certificate at
       $BASE/shared/certs/origin.pem
       $BASE/shared/certs/origin.key      (chmod 600, owned by $APP_USER)
     Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate
     (hosts: cardpop.com.au, *.cardpop.com.au).
  3. First deploy:  su - $APP_USER -c $BASE/bin/deploy.sh
     then:          systemctl status cardpop   /   journalctl -u cardpop -f
  4. For the GitHub deploy workflow, add the workflow's public key to
     /home/$APP_USER/.ssh/authorized_keys and set the VPS_* repository
     secrets — see docs/vultr-rollout.md.
MSG
