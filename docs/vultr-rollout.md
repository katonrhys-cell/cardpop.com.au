# Hosting on a VPS (Vultr)

CardPop moves off Vercel onto a single Vultr VPS, running exactly the stack the
project already uses — Node and npm — with nothing new in between: one Node
process under systemd, terminating TLS itself with a Cloudflare Origin CA
certificate, and Cloudflare proxying in front as before. This is the runbook:
what runs on the box, how to provision it, how a deploy happens, how to cut DNS
over, and how to roll back. Everything in the repository that the move needed
is on the `vultr-rollout` branch (PR #1117).

## What changes, what doesn't

| | On Vercel | On the VPS |
|---|---|---|
| Static build (`dist/`) | Vercel's CDN | `server/app.js` (Express static), cached at Cloudflare's edge with the same `Cache-Control` rules |
| Express API (`src/app.js`) | `api/index.js`, 40 s serverless function | the same app inside one long-lived Node process — no cold start, no 40 s budget |
| Prerender, sitemap, merchant feed, cron and grade-estimate functions (`api/*.js`) | one serverless function each (10–300 s) | the same modules, mounted by the server under their public paths |
| Redirects, bot rewrites, headers (`vercel.json`) | Vercel's edge | read from the same file by `server/vercelRoutes.js` — identical behaviour, nothing re-typed |
| TLS at the origin | Vercel | Node's `https` server with a **Cloudflare Origin CA** certificate |
| Process supervision | Vercel | systemd (`deploy/cardpop.service`): restarts on crash, starts on boot, logs to the journal |
| Deploy trigger | Vercel Git integration | `.github/workflows/deploy.yml` → SSH → `deploy/deploy.sh` (build on the box, into a new release directory) |
| Environment variables | Vercel dashboard | `/opt/cardpop/shared/.env` on the box (runtime **and** the `VITE_*` build values) |
| Cloudflare (DNS, proxy, WAF, image CDN Worker, scheduler Worker) | in front | **unchanged** — only the A/AAAA records move |
| Supabase, Stripe, Resend, Kit, GA4… | — | unchanged |
| React, Vite, Express, the code | — | unchanged |

What the move buys: no serverless time limits (the grade estimator, event scan
and blog generation no longer need their own functions, though they keep
working through the same paths), no per-invocation billing, a plain Node
process you can `journalctl -f`, and preview-deploy complexity gone. What it
costs: you own the box — OS patches (unattended-upgrades is on), disk, and a
second or two of connection resets while a deploy restarts the process.

## The pieces in the repo

| File | Role |
|---|---|
| `server/index.js` | Entry point (`npm start`, the systemd `ExecStart`). Loads `.env`, warms every function module, listens — HTTPS on `HTTPS_PORT` when `TLS_CERT_FILE`/`TLS_KEY_FILE` are set (with `PORT` redirecting to https), plain HTTP on `PORT` otherwise — and drains on SIGTERM |
| `server/app.js` | The Express server: redirects → headers → exact static file → rewrites into functions → `index.html` for `/`, `app.html` for every other route, 404 for a missing `/images` or `/assets` file. `GET /healthz` for the deploy script and monitoring |
| `server/vercelRoutes.js` | Interprets `vercel.json`: path-to-regexp v6 sources, `has` host/header conditions (`(?i)` → the `i` flag), chained rewrites that stop on a function or file (Vercel's filesystem check), "last header wins" |
| `deploy/cardpop.service` | systemd unit: `User=cardpop`, `WorkingDirectory=/opt/cardpop/current`, binds :80/:443 with `CAP_NET_BIND_SERVICE` only, `TRUST_PROXY_HOPS=0`, hardened (`ProtectSystem=strict`, `NoNewPrivileges`…) |
| `deploy/setup-vps.sh` | One-time Ubuntu 24.04 bootstrap (Node 24, swap, `cardpop` user, layout, unit, sudo rule, firewall, clone) |
| `deploy/deploy.sh` | The deploy: fetch → export the commit into `releases/<id>` → `npm ci` → `vite build` → prune dev deps → flip `current` → restart → wait for `/healthz`, rolling back on failure; `--detach` for the workflow; emails on failure |
| `deploy/cloudflare-firewall.sh` | ufw: 80/443 from Cloudflare's published ranges only; weekly cron |
| `.github/workflows/deploy.yml` | push to `main` → SSH → `/opt/cardpop/bin/deploy.sh --detach <sha>` |
| `tests/backend/vercelRoutes.test.js`, `tests/backend/vpsServer.test.js` | The routing interpreter against the real manifest; the server against a stub `dist/` and stub functions |

`vercel.json` stays the routing manifest for now because both hosts run from
it during the cutover. Once Vercel is switched off, rename it (for example
`server/routes.json`), point `loadRoutingConfig()` and the three places that
read it (`vite.config.js` for the CSP hash, `tests/backend/vercelHeaders.test.js`,
`tests/backend/vercelSpaFallback.test.js`) at the new name, and delete the
`functions`/`buildCommand` keys that only Vercel understood.

### Layout on the box

```
/opt/cardpop/
├── repo/                 git clone of the repository — only ever fetched
├── releases/
│   ├── 20261103011500-1422b37/   one directory per deploy: that commit's files,
│   └── 20261104093012-9a1f0c2/   node_modules (production only) and dist/
├── current -> releases/20261104093012-9a1f0c2   what systemd runs
├── shared/
│   ├── .env              the environment (linked into every release as .env)
│   └── certs/origin.pem, origin.key   Cloudflare Origin CA certificate
├── logs/deploy.log
└── bin/deploy.sh         copy of deploy/deploy.sh, refreshed by each deploy
```

## Sizing

The runtime is light: one Node process (~250 MB RSS warm). **The build is
not** — `vite build` for this app peaks at 2–3 GB (opencv wasm, the chunk
graph, beasties), and `deploy.sh` builds on the box. Pick a plan with **4 GB
RAM** (Vultr "High Frequency" or "Regular" 2 vCPU / 4 GB), or 2 GB plus the
2 GB swapfile `setup-vps.sh` adds automatically; the build is slower on swap
but completes. Region: **Sydney**, which keeps the Stripe/Resend/Supabase
round trips short for Australian buyers. 80 GB of NVMe is plenty — a release
is ~1 GB including `node_modules`, and only the last three are kept.

## Provision (once)

1. **Create the VPS**: Ubuntu 24.04 LTS, the plan above, Sydney, with your SSH
   key. Enable Vultr's automatic backups if you want a box-level snapshot
   (there is no state on the box worth more than a redeploy — the database is
   Supabase — but it saves re-running setup).

2. **Bootstrap** as root (`ADMIN_IP` is optional and locks SSH to that
   address; omit it to keep SSH open with rate limiting):

   ```bash
   scp deploy/setup-vps.sh root@<vps-ip>:
   ssh root@<vps-ip> 'ADMIN_IP=<your-ip> bash setup-vps.sh'
   ```

   It installs Node 24, adds swap if RAM < 4 GB, creates the `cardpop` user,
   prints a **Deploy Key** to add at GitHub → repo → Settings → Deploy keys
   (read-only), clones to `/opt/cardpop/repo`, installs the systemd unit and
   the sudo rule that lets `cardpop` restart it, sets up ufw (SSH + 80/443 from
   Cloudflare only) and fail2ban, and leaves `shared/.env` and `shared/certs/`
   for you.

3. **Environment**: `su - cardpop`, then edit `/opt/cardpop/shared/.env`.
   Every variable in CLAUDE.md → Deployment goes here — the runtime ones *and*
   the `VITE_*` build-time ones, which previously lived in Vercel's dashboard
   as two separate groups. Add:

   ```
   DEPLOY_ALERT_EMAIL=admin@cardpop.com.au    # deploy.sh emails here on failure (via RESEND_API_KEY)
   ```

   Keep `CORS_ORIGIN=https://cardpop.com.au` and `APP_URL=https://cardpop.com.au`.
   `chmod 600`. `PORT`, `HTTPS_PORT`, `TRUST_PROXY_HOPS` and the `TLS_*` paths
   are set by the unit file, not here. Nothing reads Vercel's `VERCEL_URL` any
   more (`src/utils/returnUrl.js` falls back to `APP_URL`/`CORS_ORIGIN`).

4. **Origin certificate**: Cloudflare dashboard → SSL/TLS → **Origin Server**
   → Create Certificate (RSA 2048, hosts `cardpop.com.au` and
   `*.cardpop.com.au`, 15 years). Save the certificate as
   `/opt/cardpop/shared/certs/origin.pem` and the key as
   `/opt/cardpop/shared/certs/origin.key` (`chmod 600`, owned by `cardpop`).
   Then SSL/TLS → Overview → encryption mode **Full (strict)** (if it isn't
   already). Node reads the pair at start; when the certificate is ever
   replaced, `sudo systemctl restart cardpop`.

5. **First deploy** (still as `cardpop`):

   ```bash
   /opt/cardpop/bin/deploy.sh
   ```

   Expect 3–6 minutes the first time (`npm ci`, the Vite build, the prune). It
   ends with `deployed <sha> OK` once `/healthz` answers over HTTPS. Then
   `systemctl status cardpop` and `journalctl -u cardpop -f`.

6. **Test the origin directly, before DNS moves.** Cloudflare won't talk to it
   yet, and the firewall admits only Cloudflare on 443, so test from the box:

   ```bash
   curl -sk --resolve cardpop.com.au:443:127.0.0.1 https://cardpop.com.au/healthz
   curl -sk --resolve cardpop.com.au:443:127.0.0.1 https://cardpop.com.au/api/health
   curl -sk --resolve cardpop.com.au:443:127.0.0.1 -A Googlebot https://cardpop.com.au/shop | head -c 400
   curl -skI --resolve cardpop.com.au:443:127.0.0.1 https://cardpop.com.au/assets/$(ls /opt/cardpop/current/dist/assets | head -1)
   curl -sI --resolve cardpop.com.au:80:127.0.0.1 http://cardpop.com.au/shop        # 308 → https
   ```

   (`-k` because the Origin CA is only trusted by Cloudflare.) To test from your
   own machine, temporarily `ufw allow from <your-ip> to any port 443 proto tcp`
   and use `--resolve cardpop.com.au:443:<vps-ip>`; delete the rule after.
   Check the Stripe webhook path answers 400 (bad signature), not 404:
   `curl -sk -X POST --resolve … https://cardpop.com.au/hcgi/api/stripe/webhook`.

7. **GitHub deploy workflow**: on your machine `ssh-keygen -t ed25519 -N '' -f
   deploy-key`; append `deploy-key.pub` to `/home/cardpop/.ssh/authorized_keys`
   on the box; add repository secrets `VPS_HOST`, `VPS_USER` (`cardpop`),
   `VPS_SSH_KEY` (the private key) and `VPS_KNOWN_HOSTS` (the output of
   `ssh-keyscan -t ed25519 <vps-ip>`). Run the **Deploy** workflow by hand once
   (Actions → Deploy → Run workflow) and watch `/opt/cardpop/logs/deploy.log`.

## Cutover

Do this at a quiet hour; the switch itself is a DNS edit and takes effect in
seconds because the records are proxied (Cloudflare resolves the origin
internally — TTL doesn't matter).

1. **Note the current records** (Cloudflare → DNS): the `A`/`CNAME` for
   `cardpop.com.au` and `www` pointing at Vercel. Write them down — they are
   the rollback.
2. **Change `cardpop.com.au` to an `A` record → `<vps-ip>`**, proxied (orange
   cloud). Add an `AAAA` with the VPS's IPv6 if it has one. Point `www` at the
   same (an `A`, or `CNAME cardpop.com.au`) — the server 308s it to the apex.
   Leave `img.cardpop.com.au` and every other record alone.
3. **Verify** from outside: `curl -sI https://cardpop.com.au/ | grep -i
   '^server\|^cache-control'` (no more `server: Vercel`),
   `https://cardpop.com.au/healthz`, sign in, open a product, the Account page,
   Admin → Dashboard. Place a test order with a Stripe test card if the account
   is in test mode; otherwise watch the Stripe dashboard → Webhooks for the
   next real `checkout.session.completed` to show a 2xx from the new origin
   (the endpoint URL is unchanged, so nothing to edit in Stripe).
4. **Scheduler**: nothing to change — the Worker calls
   `https://cardpop.com.au/...`, which now reaches the box. Run
   `POST /run/reconcile` on the Worker by hand (docs/scheduled-jobs.md) and
   check it reports success.
5. **Watch for a day**: `journalctl -u cardpop -f`, Sentry, Cloudflare →
   Analytics → origin 5xx. Keep the Vercel project alive but idle.
6. **Decommission Vercel after a week**: remove the domain from the Vercel
   project (so a stale deploy can never answer for it), disconnect the Git
   integration (Vercel → Settings → Git) so merges stop building previews
   there, then delete the project. Delete the stale `cardpop-com-au` and
   `cardpop-com-au-343z` projects that have been posting "Deployment was
   blocked" on every PR. Finally open the follow-up PR that renames
   `vercel.json` (see above), drops `@vercel/analytics` / `@vercel/speed-insights`
   from `main.jsx` and `package.json`, and removes the Vercel wording from the
   docs.

### Rollback

Put the Cloudflare `A`/`CNAME` records back to the Vercel values you noted. That
is the whole rollback while the Vercel project still exists — the box can stay
up. If the problem is a bad deploy rather than the host, roll the box back
instead: `deploy.sh <previous-sha>`, or by hand
`ln -sfn /opt/cardpop/releases/<older> /opt/cardpop/current && sudo systemctl restart cardpop`
(the last three releases are kept).

## Day to day

**Deploying** is a merge to `main`. The workflow SSHes in and starts
`deploy.sh --detach <sha>`; the job finishes in seconds and bills about one
Actions minute, while the box exports that commit into a fresh release
directory, installs, builds (2–4 minutes; `npm ci` is fast from the local
cache when `package-lock.json` hasn't changed), prunes dev dependencies,
flips `current` and restarts the service. The running release is untouched
until the flip, so a failed build changes nothing; a release that doesn't come
up healthy within a minute is rolled back to the previous one. Progress and
the result are in `/opt/cardpop/logs/deploy.log`; a failure emails
`DEPLOY_ALERT_EMAIL`. Deploy by hand with `su - cardpop -c
/opt/cardpop/bin/deploy.sh` (optionally a sha). Two deploys never overlap (a
lock); a second waits.

**Logs**: `journalctl -u cardpop -f` (morgan access lines for the API,
`[SERVER]` lines, the structured `logger` output). The journal is
size-capped by systemd's defaults. Sentry still receives 5xx from the API.

**Env changes**: edit `/opt/cardpop/shared/.env`, then redeploy
(`deploy.sh`) — a `VITE_*` change needs the rebuild, and a runtime-only change
needs at least `sudo systemctl restart cardpop`. There is no dashboard; the
file is the record (`chmod 600`, owned by `cardpop`, never leaves the box).

**OS**: `unattended-upgrades` applies security patches; reboot monthly or when
`/var/run/reboot-required` appears (the unit is `enabled`, so the server comes
back on its own). Node itself: `apt upgrade nodejs` picks up new 24.x
releases from the NodeSource repository.

**Cloudflare ranges**: `/etc/cron.weekly/cardpop-cloudflare-firewall` refreshes
the ufw allow-list. `src/utils/cloudflareIps.js` is the matching list inside
the app; update it if Cloudflare announces new ranges.

**Disk**: `du -sh /opt/cardpop/releases/*`; `deploy.sh` keeps the newest
three. `npm cache clean --force` as `cardpop` if `~/.npm` grows.

## How the request path works now

Client → Cloudflare (TLS, WAF, cache, bot fight mode) → Node on the box
(TLS with the Origin CA certificate, :443).

- **Trust**: Cloudflare sends `X-Forwarded-For: <visitor>` and connects from
  one of its edge addresses. The server (both `server/app.js` and
  `src/app.js`) runs with `TRUST_PROXY_HOPS=0`, so it trusts **only**
  Cloudflare edge addresses in that chain: `req.ip` is the real visitor for
  every IP-keyed control, and a request that reaches the box without going
  through Cloudflare can't forge it — its own address isn't a Cloudflare one,
  so it is pinned to itself. (On Vercel the value was 1, because Vercel's own
  proxy sat in front; leaving it at 1 here would let a direct request forge
  its IP, which is why the unit file sets 0.) The firewall makes such a request
  unlikely in the first place.
- **Headers and caching**: the `headers` rules in the manifest are applied by
  Node before the file or function answers, so a function's own
  `Cache-Control` (the prerender's `s-maxage`, the API's `no-store`) still wins,
  and Cloudflare caches `/assets`, `/images`, fonts and the unhashed public
  files exactly as before (docs/performance.md → Edge caching). Cloudflare's
  **cache rules** that were tuned for the Vercel origin need no change — they
  key on the URL and these headers.
- **Bots**: the prerender rewrites are user-agent conditions in the manifest
  and work unchanged; `curl -A Googlebot https://cardpop.com.au/shop` returns
  the prerendered HTML and a browser gets `app.html`.
- **Compression**: Node sends plain bytes; Cloudflare compresses (Brotli/gzip)
  for the visitor, as it did in front of Vercel. Origin → Cloudflare traffic is
  uncompressed, which is well inside Vultr's bandwidth allowance; `compression`
  middleware was deliberately not added because it would buffer the grade
  estimator's SSE stream.
- **Timeouts**: Node has no request budget. **Cloudflare still cuts a proxied
  request at 100 s** (error 524) — on Vercel too — which only matters for the
  scheduler's long jobs (`/cron/event-scan`, `/cron/blog-generate`), where the
  Worker's `maxSeconds` is 330. The job keeps running on the box and
  completes; the Worker just logs a failure. If that noise matters, give the
  Worker a **DNS-only** hostname for the origin (`origin.cardpop.com.au`, grey
  cloud, in `BASE_URL`): Workers egress from Cloudflare IP space, so the
  firewall already admits them, the Origin CA cert covers the wildcard, and the
  100 s edge limit no longer applies. Don't point browsers at that hostname.
- **Health**: `GET /healthz` answers from the server without touching the API;
  `GET /api/health` still exists.

## Known differences from Vercel

- **Preview deployments are gone.** PRs are verified by CI (lint, tests, build,
  E2E) but not deployed anywhere. If a preview is needed, run it locally:
  `npm run build && npm start` with a local `.env` (plain HTTP on :3000).
- **A deploy restarts the process**: in-flight requests get up to 10 s to
  finish, then connections reset for the second or two Node takes to come
  back; Cloudflare's "Always Online" can mask it for cached pages. If that
  ever matters, the fix is a second process on another port and a proxy to
  switch between them — not needed today.
- **`@vercel/analytics` and `@vercel/speed-insights`** load on any non-local
  host and request `/_vercel/insights/script.js`, which now falls through to
  `app.html`. The browser logs a script error and nothing else happens; they
  are removed in the follow-up PR with the `vercel.json` rename. Web Analytics
  continues in Cloudflare (`VITE_CF_BEACON_TOKEN`) and GA4.
- **`VERCEL_URL` return-URL fallbacks** (`src/utils/returnUrl.js`) are simply
  unset; `APP_URL` and `CORS_ORIGIN` carry the allow-list.
- **`npm start`** now runs the real server (`node server/index.js`), not
  `vite preview`; the preview is `npm run preview`. Playwright still uses
  `vite preview` explicitly.
