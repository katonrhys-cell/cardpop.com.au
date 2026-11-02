#!/usr/bin/env bash
# Allow HTTP/HTTPS into the VPS from Cloudflare's edge only. Cloudflare proxies
# cardpop.com.au, so every legitimate visitor arrives from one of its
# published ranges; anything else hitting :80/:443 is bypassing the WAF, the
# bot fight mode and the rate limits, and is dropped. Re-run (it is
# idempotent — rules tagged "cloudflare" are replaced) whenever Cloudflare
# announces new ranges; setup-vps.sh installs it as a weekly cron.
#
# Needs root (ufw). Runbook: docs/vultr-rollout.md → Firewall.
set -euo pipefail

V4=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)
V6=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)
[[ -n "$V4" && -n "$V6" ]] || { echo "could not fetch Cloudflare ranges" >&2; exit 1; }

# Drop the previous Cloudflare rules (by their comment), highest number first
# so the numbering doesn't shift under us.
while read -r num; do
  [[ -n "$num" ]] && ufw --force delete "$num" > /dev/null
done < <(ufw status numbered | grep -F '# cloudflare' | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn)

for cidr in $V4 $V6; do
  ufw allow proto tcp from "$cidr" to any port 80,443 comment cloudflare > /dev/null
done

echo "ufw: allowing 80/443 from $(echo "$V4" | wc -l) IPv4 + $(echo "$V6" | wc -l) IPv6 Cloudflare ranges"
