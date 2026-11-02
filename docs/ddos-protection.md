# DDoS & abuse protection

How CardPop is protected, what was hardened in code, and the Cloudflare /
Supabase dashboard settings that complete the setup. The dashboard steps are
one-time, take ~15 minutes total, and everything recommended here is on the
**free** plans.

## The layers

| Layer | What it stops | Where it lives |
|---|---|---|
| Cloudflare proxy (always-on) | Volumetric L3/L4/L7 DDoS floods | Automatic — DNS is orange-clouded (verify: `dig A cardpop.com.au` returns 104.21.x / 172.67.x) |
| Cloudflare Bot Fight Mode + WAF + rate-limit rule | Bots, common exploits, request floods that would saturate the VPS | Cloudflare dashboard — **checklist below** |
| VPS firewall (`deploy/cloudflare-firewall.sh`) | Only Cloudflare's edge ranges may reach ports 80/443, so nothing can go around the layers above | ufw on the box, refreshed weekly |
| Express rate limiters | Targeted abuse: credential stuffing, OTP brute force, email bombing | `src/middleware/global-rate-limit.js`, `src/middleware/endpoint-rate-limit.js` |
| Turnstile CAPTCHA | Bot signups/logins/password resets | `components/Turnstile.jsx` + auth pages |
| Image CDN worker | Supabase storage egress exhaustion | `cloudflare/image-proxy-worker.js` on `img.cardpop.com.au` |

The Express limiters are **abuse throttles, not DDoS defence**: they keep
in-memory counters inside the single Node process on the VPS (formerly one per Vercel instance), reset on
cold start. Volumetric traffic is Cloudflare's job; the app layer provides
precision (per-user, per-email, per-endpoint budgets).

## What the code does (this repo)

- **Real client IPs behind Cloudflare** — `src/app.js` sets a `trust proxy`
  function that trusts Cloudflare's published edge ranges (and nothing before them —
  `TRUST_PROXY_HOPS=0`, since Node faces Cloudflare directly on the VPS)
  (`src/utils/cloudflareIps.js`). `req.ip` — and with it every rate-limit
  key, the login lockout, and audit logs — resolves to the actual visitor,
  not a shared Cloudflare edge IP. Requests that bypass Cloudflare (hitting
  the `*.vercel.app` host directly) get pinned to their own connecting IP, so
  `X-Forwarded-For` spoofing remains impossible either way.
  If Cloudflare ever announces new ranges, refresh the list in
  `src/utils/cloudflareIps.js` from https://www.cloudflare.com/ips.
- **Cache-busting defence on the image CDN** — the worker canonicalises query
  strings before fetching Supabase (stripped on `/object/` paths;
  transform params allowlisted, ladder-snapped and sorted on
  `/render/image/` paths). Random query strings all collapse onto one edge
  cache key instead of each one burning metered origin egress.
  ⚠️ The worker is deployed by hand: after merging, paste the updated
  `cloudflare/image-proxy-worker.js` into Workers & Pages →
  `cardpop-image-proxy` → Edit code → Deploy (see `docs/image-cdn.md`).

## Cloudflare dashboard checklist (one-time, free plan)

All under https://dash.cloudflare.com → the `cardpop.com.au` zone.

### 1. Bot Fight Mode

**Security → Bots → Bot Fight Mode → On.**

Challenges traffic that matches known bot patterns. Verified crawlers
(Googlebot, Bingbot, and most of the AI crawlers the prerender rewrites in
`vercel.json` target) are on Cloudflare's verified-bots list and are never
challenged, so SEO prerendering keeps working. Unverified scrapers (e.g.
Bytespider) will start getting challenged — that's a feature. It cannot be
scoped to paths on the free plan; if it ever causes a real problem, toggle it
off — no other setting depends on it.

### 2. WAF managed ruleset

**Security → WAF → Managed rules.** Confirm **"Cloudflare Managed Free
Ruleset"** shows as enabled/deployed (on free zones it usually is by
default — this step is a verification). It blocks broadly-dangerous exploit
patterns (Log4j/Shellshock-class) at the edge before they reach the origin.

### 3. Rate-limiting rule on the API

The free plan includes **one** rate-limiting rule: counting is per-IP, the
window is fixed at 10 seconds, and the action is Block. Point it at the API
paths so floods are dropped at the edge **before they reach the origin**:

**Security → WAF → Rate limiting rules → Create rule:**

- **Name**: `api-flood-guard`
- **If incoming requests match** (use "Edit expression"):

  ```
  (starts_with(http.request.uri.path, "/hcgi/api/") or starts_with(http.request.uri.path, "/api/"))
  and not ends_with(http.request.uri.path, "/stripe/webhook")
  ```

  (Or with the builder: URI Path *starts with* `/hcgi/api/` OR URI Path
  *starts with* `/api/`, AND NOT URI Path *ends with* `/stripe/webhook`.)
  Both prefixes matter — `vercel.json` routes `/api/*` to the same function,
  so guarding only `/hcgi/api/*` leaves a bypass. The Stripe webhook is
  carved out so a burst of legitimate Stripe retries is never blocked (it is
  signature-verified and has its own app-level limiter).

- **Rate**: `60` requests per `10 seconds` per IP → **Block**.

Why 60/10s: a page load fires well under 10 API calls, so real users never
hit it, while sustained floods die at the edge. The app-level global limiter
(50 requests / 5 min) stays much stricter — the edge rule is the cost shield,
the app limiter is the precision control.

### 4. Pre-stage the Under Attack Mode bypass for Stripe

Under Attack Mode (below) serves a JavaScript challenge that **server-to-
server callers can never pass** — flipping it on would silently break Stripe
webhooks. Create the exemption now so UAM is always safe to use:

**Security → WAF → Custom rules → Create rule:**

- **Name**: `stripe-webhook-bypass`
- **Expression**: `ends_with(http.request.uri.path, "/stripe/webhook")`
- **Action**: **Skip** → tick *All remaining custom rules* and, under "More
  components to skip", **Security Level** (this is what UAM raises) and
  **Rate limiting** if offered.

The webhook stays safe to exempt: `src/routes/stripe.js` verifies every
payload's signature with `STRIPE_WEBHOOK_SECRET` before acting on it.

### 5. Under Attack Mode — emergency playbook (nothing to enable today)

When the site is actively being hammered:

1. Zone **Overview → Quick Actions → Under Attack Mode → On** (equivalently
   Security → Settings → Security Level → *I'm Under Attack*).
2. Every new visitor gets a ~5-second JS interstitial once; after the
   clearance cookie is set, the SPA and its API calls work normally.
3. Watch **Security → Events** to see what's being challenged/blocked, and
   the attack pattern (paths, ASNs, countries). If it's concentrated, replace
   UAM with a targeted custom rule (block/challenge by ASN or country) and
   turn UAM off.
4. **Turn it off when the attack subsides** — left on, it challenges
   unverified crawlers and adds friction for every first-time visitor.

### 6. While you're in the dashboard (30 seconds)

**SSL/TLS → Overview**: confirm mode is **Full (strict)**. Anything weaker
lets a MITM sit between Cloudflare and the origin. The VPS presents a Cloudflare Origin CA certificate (docs/vultr-rollout.md).

## The Supabase direct-exposure issue

The frontend talks straight to `vrfsaazuqjxotnieqlkd.supabase.co` (Auth,
PostgREST, Storage, Realtime) — that traffic **bypasses Cloudflare
entirely**. Supabase's platform has its own infrastructure-level DDoS
mitigation, so the realistic risk is not downtime but **quota/cost
exhaustion**: metered storage egress, auth email quotas, and database load.
Defence in depth, cheapest first:

### a. Storage egress (the big one) — already engineered, verify it's live

1. **`/opt/cardpop/shared/.env` on the VPS (then redeploy)**:
   confirm `VITE_IMAGE_CDN_HOST` and `IMAGE_CDN_HOST` are both set to
   `img.cardpop.com.au`. (Couldn't be verified from this session — it's the
   one config flag this whole layer hangs on. If missing, add both and
   redeploy; `VITE_*` is baked at build time.)
2. **Redeploy the hardened worker** from this branch (see code section
   above).
3. Spot-check: on cardpop.com.au, DevTools → Network → Img — card images
   should load from `img.cardpop.com.au` with `cf-cache-status: HIT` on
   repeat views.

An attacker hammering `img.cardpop.com.au` now hits Cloudflare's unmetered
edge cache; hammering unique-random query strings gets collapsed onto one
cache key by the worker. Direct hits on `*.supabase.co/storage` URLs remain
possible (old DB-stored URLs resolve there) but repeat traffic is absorbed by
Supabase's own CDN cache and the app's service worker; if egress spikes
anyway, the Supabase usage report (below) will show it.

### b. Auth endpoint abuse

**Supabase dashboard → Authentication → Rate Limits.** Defaults are sane;
confirm/tighten:

- Emails (signup/magic-link/reset): the built-in SMTP is already capped very
  low (~2/hr) — fine, the app sends its own MFA emails.
- Token verifications / sign-ins: keep defaults unless the auth logs show
  abuse.

**Optional, stronger**: Supabase Auth has native Turnstile support
(**Authentication → Attack Protection → CAPTCHA**). The site already runs
Turnstile on its own auth pages, but enabling it Supabase-side requires
passing `captchaToken` through the `supabase.auth.signInWithPassword()` /
`signUp()` calls in `contexts/AuthContext.jsx` — a small follow-up code
change. Don't flip the dashboard toggle before that lands or logins will
fail.

### c. Database / REST

Row Level Security already gates every anon read/write, and Supabase applies
a statement timeout to the anon role, so the flood risk is load, not data.
Nothing to change — just know **Reports → Database** shows connection/CPU
pressure if the REST endpoint is ever hammered.

### d. Monitoring & the cost backstop

- **Supabase dashboard → Reports / Usage**: egress, auth emails, DB load.
  On the free plan the project **pauses** at quota rather than billing you —
  an availability risk, not a financial one. On Pro, set the **spend cap**
  (Settings → Billing) to convert surprise bills into a hard stop.
- Cloudflare **Security → Events** + **Analytics**: what's being challenged
  and blocked at the edge.
- Server logs (`journalctl -u cardpop`): `[RATE_LIMIT]` lines show who's tripping app-level
  limits — after this branch deploys, they show real visitor IPs.

### e. If quota abuse ever becomes real: custom domain (paid, last resort)

Supabase's custom-domain add-on (~US$10/mo) would serve the API from
`api.cardpop.com.au`. Note it does **not** simply put Cloudflare's proxy in
front — Supabase requires the CNAME during setup and proxying it afterwards
is unsupported/fragile. Treat it as a branding/flexibility upgrade, not a
DDoS layer, and only bother if monitoring shows sustained targeted abuse.

## Verifying after deploy

1. `curl -sI https://cardpop.com.au/hcgi/api/health | grep -i 'cf-ray\|server'`
   → confirms Cloudflare is in the path (`server: cloudflare` + a `cf-ray`).
2. Trip the edge rule: `for i in $(seq 1 80); do curl -s -o /dev/null -w '%{http_code}\n' https://cardpop.com.au/hcgi/api/health; done`
   → first ~60 return 200/429, then Cloudflare 429 block pages until the 10s
   window rolls.
3. Check a server log line from `[RATE_LIMIT]` or an auth audit row: the IP
   should be a real ISP address, **not** in 104.16.0.0/13, 172.64.0.0/13 or
   another Cloudflare range.
