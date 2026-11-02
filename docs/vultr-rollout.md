# Hosting on a VPS (Vultr)

CardPop moves off Vercel onto a single VPS. This is the runbook: what runs on
the box, how to provision it, how a deploy happens, how to cut DNS over, and
how to roll back. Everything in the repository that the move needed is on the
`vultr-rollout` branch (PR #1117).

## What changes, what doesn't

| | On Vercel | On the VPS |
|---|---|---|
| Static build (`dist/`) | Vercel's CDN | `server/app.js` (Express static) behind Caddy, cached at Cloudflare's edge with the same `Cache-Control` rules |
| Express API (`src/app.js`) | `api/index.js`, 40 s serverless function | the same app inside one long-lived Node process — no cold start, no 40 s budget |
| Prerender, sitemap, merchant feed, cron and grade-estimate functions (`api/*.js`) | one serverless function each (10–300 s) | the same modules, mounted by the server under their public paths |
| Redirects, bot rewrites, headers (`vercel.json`) | Vercel's edge | read from the same file by `server/vercelRoutes.js` — identical behaviour, nothing re-typed |
| TLS at the origin | Vercel | Caddy with a **Cloudflare Origin CA** certificate |
| Deploy trigger | Vercel Git integration | `.github/workflows/deploy.yml` → SSH → `deploy/deploy.sh` (build on the box) |
| Environment variables | Vercel dashboard | `/opt/cardpop/app/.env` on the box (runtime **and** the `VITE_*` build values) |
| Cloudflare (DNS, proxy, WAF, image CDN Worker, scheduler Worker) | in front | **unchanged** — only the A/AAAA records move |
| Supabase, Stripe, Resend, Kit, GA4… | — | unchanged |

What the move buys: no serverless time limits (the grade estimator, event scan
and blog generation no longer need their own functions, though they keep
working through the same paths), no per-invocation billing, a plain Node
process you can `docker logs`, and preview-deploy complexity gone. What it
costs: you own the box — OS patches (unattended-upgrades is on), disk, and a
few seconds of 502 while a deploy swaps containers.

## The pieces in the repo

| File | Role |
|---|---|
| `server/index.js` | Entry point (`npm start`, the Docker `CMD`). Loads `.env`, warms every function module, listens on `PORT` (3000), drains on SIGTERM |
| `server/app.js` | The Express server: redirects → headers → exact static file → rewrites into functions → `index.html` for `/`, `app.html` for every other route, 404 for a missing `/images` or `/assets` file. `GET /healthz` for Docker/Caddy |
| `server/vercelRoutes.js` | Interprets `vercel.json`: path-to-regexp v6 sources, `has` host/header conditions (`(?i)` → the `i` flag), chained rewrites that stop on a function or file (Vercel's filesystem check), "last header wins" |
| `Dockerfile`, `.dockerignore` | Three-stage image: `npm ci` → `vite build` (with `.env` mounted as a BuildKit secret so Vite sees the `VITE_*` values without them landing in a layer) → runtime with production deps + `dist/` + the backend directories |
| `docker-compose.yml` | `app` (the image above, `env_file: .env`) + `caddy` (ports 80/443, Origin CA cert from `deploy/certs/`) |
| `deploy/Caddyfile` | TLS, zstd/gzip, reverse proxy with SSE flushing and a 330 s upstream timeout, JSON access logs |
| `deploy/setup-vps.sh` | One-time Ubuntu 24.04 bootstrap (Docker, swap, `cardpop` user, firewall, clone) |
| `deploy/deploy.sh` | The deploy: fetch, build, swap, health-wait, prune; `--detach` for the workflow; emails on failure |
| `deploy/cloudflare-firewall.sh` | ufw: 80/443 from Cloudflare's published ranges only; weekly cron |
| `.github/workflows/deploy.yml` | push to `main` → SSH → `deploy.sh --detach <sha>` |
| `tests/backend/vercelRoutes.test.js`, `tests/backend/vpsServer.test.js` | The routing interpreter against the real manifest; the server against a stub `dist/` and stub functions |

`vercel.json` stays the routing manifest for now because both hosts run from
it during the cutover. Once Vercel is switched off, rename it (for example
`server/routes.json`), point `loadRoutingConfig()` and the three places that
read it (`vite.config.js` for the CSP hash, `tests/backend/vercelHeaders.test.js`,
`tests/backend/vercelSpaFallback.test.js`) at the new name, and delete the
`functions`/`buildCommand` keys that only Vercel understood.

## Sizing

The runtime is light: one Node process (~250 MB RSS warm) plus Caddy. **The
build is not** — `vite build` for this app peaks at 2–3 GB (opencv wasm, the
chunk graph, beasties), and `deploy.sh` builds on the box. Pick a plan with
**4 GB RAM** (Vultr "High Frequency" or "Regular" 2 vCPU / 4 GB), or 2 GB plus
the 2 GB swapfile `setup-vps.sh` adds automatically; the build is slower on
swap but completes. Region: **Sydney** (Supabase is in `ap-southeast-2`-adjacent
Tokyo today; Sydney also keeps the Stripe/Resend/Supabase round trips short
for Australian buyers). 80 GB of NVMe is plenty — the image is ~700 MB and old
images are pruned on every deploy.

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

   It installs Docker, adds swap if RAM < 4 GB, creates the `cardpop` user,
   prints a **Deploy Key** to add at GitHub → repo → Settings → Deploy keys
   (read-only), clones to `/opt/cardpop/app`, sets up ufw (SSH + 80/443 from
   Cloudflare only) and fail2ban, and leaves `.env` and `deploy/certs/` for you.

3. **Environment**: `su - cardpop`, then edit `/opt/cardpop/app/.env`. Every
   variable in CLAUDE.md → Deployment goes here — the runtime ones *and* the
   `VITE_*` build-time ones, which previously lived in Vercel's dashboard as
   two separate groups. Add:

   ```
   DEPLOY_ALERT_EMAIL=admin@cardpop.com.au    # deploy.sh emails here on failure (via RESEND_API_KEY)
   TRUST_PROXY_HOPS=1                          # Caddy is the one trusted hop (compose sets this too)
   ```

   Keep `CORS_ORIGIN=https://cardpop.com.au` and `APP_URL=https://cardpop.com.au`.
   `chmod 600 .env`. Nothing reads Vercel's `VERCEL_URL` any more
   (`src/utils/returnUrl.js` falls back to `APP_URL`/`CORS_ORIGIN`).

4. **Origin certificate**: Cloudflare dashboard → SSL/TLS → **Origin Server**
   → Create Certificate (RSA 2048, hosts `cardpop.com.au` and
   `*.cardpop.com.au`, 15 years). Save the certificate as
   `deploy/certs/origin.pem` and the key as `deploy/certs/origin.key`
   (`chmod 600`). Then SSL/TLS → Overview → encryption mode **Full (strict)**
   (if it isn't already). The directory is git-ignored.

5. **First deploy** (still as `cardpop`):

   ```bash
   /opt/cardpop/app/deploy/deploy.sh
   ```

   Expect 3–6 minutes the first time (`npm ci` twice, the Vite build). It ends
   with `deployed <sha> OK` once `docker inspect` reports the app healthy.

6. **Test the origin directly, before DNS moves.** Cloudflare won't talk to it
   yet, so talk to Caddy with the right SNI/Host from your machine:

   ```bash
   curl -sk --resolve cardpop.com.au:443:<vps-ip> https://cardpop.com.au/healthz
   curl -sk --resolve cardpop.com.au:443:<vps-ip> https://cardpop.com.au/api/health
   curl -sk --resolve cardpop.com.au:443:<vps-ip> -A Googlebot https://cardpop.com.au/shop | head -c 400
   curl -skI --resolve cardpop.com.au:443:<vps-ip> https://cardpop.com.au/assets/$(ls dist/assets | head -1)
   ```

   (`-k` because the Origin CA is only trusted by Cloudflare; the firewall
   admits only Cloudflare ranges on 443, so run these from the box itself —
   `curl -sk --resolve cardpop.com.au:443:127.0.0.1 …` — or temporarily
   `ufw allow from <your-ip> to any port 443 proto tcp` and delete the rule
   after.) Check the Stripe webhook path answers 400 (bad signature), not 404:
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
5. **Watch for a day**: `docker logs -f cardpop-app`, Sentry, Cloudflare →
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
instead: `deploy/deploy.sh <previous-sha>`.

## Day to day

**Deploying** is a merge to `main`. The workflow SSHes in and starts
`deploy.sh --detach <sha>`; the job finishes in seconds and bills about one
Actions minute, while the box fetches that commit, builds the image and swaps
the container (2–4 minutes with a warm layer cache, longer when
`package-lock.json` changed). Progress and the result are in
`/opt/cardpop/logs/deploy.log`; a failure emails `DEPLOY_ALERT_EMAIL` and
leaves the previous container serving. Deploy by hand with
`su - cardpop -c /opt/cardpop/app/deploy/deploy.sh` (optionally a sha). Two
deploys never overlap (a lock); a second waits.

**Logs**: `docker logs -f cardpop-app` (morgan access lines for the API,
`[SERVER]` lines, the structured `logger` output) and `docker logs -f
cardpop-caddy` (one JSON line per request). Both rotate at 5 × 20 MB. Sentry
still receives 5xx from the API.

**Env changes**: edit `.env`, then redeploy (`deploy.sh`) — the container has
to be recreated to see new values, and a `VITE_*` change needs the rebuild
anyway. There is no dashboard; the file is the record (it is `chmod 600`,
owned by `cardpop`, and never leaves the box).

**OS**: `unattended-upgrades` applies security patches; reboot monthly or when
`/var/run/reboot-required` appears (`docker compose` services are
`restart: unless-stopped`, so they come back on their own). Docker itself:
`apt upgrade` as root when convenient.

**Cloudflare ranges**: `/etc/cron.weekly/cardpop-cloudflare-firewall` refreshes
the ufw allow-list. `src/utils/cloudflareIps.js` is the matching list inside
the app; update it if Cloudflare announces new ranges.

**Disk**: `docker system df`. `deploy.sh` prunes dangling images; a `docker
image prune -a` once in a while removes older tagged ones.

## How the request path works now

Client → Cloudflare (TLS, WAF, cache, bot fight mode) → Caddy on the box
(TLS with the Origin CA cert, zstd/gzip) → Node on `app:3000`.

- **Trust**: Caddy keeps the `X-Forwarded-For` chain Cloudflare sends and
  appends the peer address. The Node server (both `server/app.js` and
  `src/app.js`) trusts one hop (Caddy, `TRUST_PROXY_HOPS=1`) and then only
  Cloudflare edge addresses, so `req.ip` is the real visitor for every
  IP-keyed control and a request that bypasses Cloudflare can't forge it —
  the same rule as on Vercel, where Vercel's proxy was the one trusted hop.
  The firewall makes such a request unlikely in the first place.
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
- **Compression**: Caddy compresses origin responses; Cloudflare re-encodes
  for the visitor. Node sends plain bytes.
- **Timeouts**: Node has no request budget. Caddy waits up to 330 s for
  upstream headers (the event scan's worst case). **Cloudflare still cuts a
  proxied request at 100 s** (error 524) — on Vercel too — which only matters
  for the scheduler's long jobs (`/cron/event-scan`, `/cron/blog-generate`),
  where the Worker's `maxSeconds` is 330. The job keeps running on the box and
  completes; the Worker just logs a failure. If that noise matters, give the
  Worker a **DNS-only** hostname for the origin (`origin.cardpop.com.au`, grey
  cloud, in `BASE_URL`): Workers egress from Cloudflare IP space, so the
  firewall already admits them, the Origin CA cert covers the wildcard, and the
  100 s edge limit no longer applies. Don't point browsers at that hostname.
- **Health**: `GET /healthz` (Docker, Caddy) answers from the server without
  touching the API; `GET /api/health` still exists.

## Known differences from Vercel

- **Preview deployments are gone.** PRs are verified by CI (lint, tests, build,
  E2E) but not deployed anywhere. If a preview is needed, run the image locally:
  `docker compose build app && docker compose up app` with a local `.env`, or
  `npm run build && npm start` (reads `.env`, serves on :3000).
- **A deploy is a few seconds of 502** while the container swaps (Caddy
  returns 502 until the new one is healthy). Cloudflare's "Always Online" can
  mask it for cached pages. Blue/green with two app containers is the fix if
  it ever matters.
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
