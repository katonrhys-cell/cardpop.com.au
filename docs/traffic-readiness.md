# Traffic readiness checklist

A pre-spike survival checklist for CardPop. The architecture is already built
for scale (Cloudflare edge, Vercel serverless, lazy-loaded SPA, three-layer
image egress strategy), so the risks that actually take the site down under a
traffic spike are a few config flags and a couple of hot-path query patterns —
not the design. Work top-down; items are ranked by blast radius.

Cross-references: `docs/ddos-protection.md` (Cloudflare + rate limiting),
`docs/image-cdn.md` (image egress layers).

---

## P0 — Verify before any expected spike (config, not code)

These live outside the repo (Vercel / Cloudflare / Supabase dashboards) and are
the most likely causes of a hard outage. None can be confirmed from the codebase.

- [ ] **`VITE_IMAGE_CDN_HOST` is set in Vercel** (Settings → Environment
      Variables, Production). This is the single biggest availability risk. When
      unset, `utils/imageUrl.js` `toCdnUrl()` is a no-op and **every** image
      request is metered Supabase Storage egress. On the Supabase free plan the
      project is **paused** at the 5 GB egress quota — a full outage, not a
      bill — and a spike is exactly when you cross 5 GB.
- [ ] **The `img.cardpop.com.au` Cloudflare Worker is deployed and healthy**
      (source: `cloudflare/image-proxy-worker.js`, deployed by hand via the
      dashboard). Confirm the DNS record and route exist and the worker returns
      images. The `VITE_IMAGE_CDN_HOST` flag is useless if the worker behind it
      isn't live.
- [ ] **Cloudflare edge rate-limit rule is active** — `60 req / 10s per IP` on
      `/api/*` and `/hcgi/api/*`, Stripe webhook exempted (see
      `docs/ddos-protection.md` §3). This is the *real* API abuse defence; the
      Express limiters are in-memory per-serverless-instance and do not hold
      under fan-out.
- [ ] **Cloudflare Bot Fight Mode + WAF managed ruleset are on**
      (`docs/ddos-protection.md` §2).
- [ ] **Supabase plan tier is sized for the event.** The frontend talks
      directly to Supabase for Auth / PostgREST / Storage / Realtime, which
      **bypasses Cloudflare entirely** — so the primary data path's spike
      defence is Supabase's own compute/quota headroom. If still on free/starter,
      upgrade before a known traffic event. Confirm egress + compute quotas have
      margin.
- [ ] **Know the emergency lever:** Cloudflare "Under Attack Mode" + the
      pre-staged Stripe bypass (`docs/ddos-protection.md` §4–5). Rehearse
      enabling it so it's a 30-second action, not a 30-minute scramble.

## P1 — Hot-path query cost (code changes; behaviour tradeoffs — review before shipping)

The two busiest data pages do more DB work per visitor than they need to. Under
concurrency this is what makes Supabase compute climb.

- [ ] **Marketplace count strategy** (`pages/marketplace/MarketplacePage.jsx`
      ~line 207): `{ count: 'exact' }` forces Postgres to count the full
      filtered result set on *every* page load. Switching to `'planned'` /
      `'estimated'` is far cheaper, but degrades pagination accuracy on filtered
      queries — decide whether an approximate "~N results" is acceptable, or
      only fetch the exact count on page 0.
- [ ] **Narrow `select('*')`** on marketplace (`listings` + joined
      `vault_items`) and shop (`shop_products`) to only the columns the card
      grid renders. Reduces egress and DB work per request. Trace the card
      components first so nothing that's rendered gets dropped.
- [ ] **Per-visitor Realtime subscriptions** — marketplace
      (`MarketplacePage.jsx` ~line 268) and shop (`ShopPage.jsx` ~line 65) each
      open a `postgres_changes` channel that **re-runs the entire query on every
      table UPDATE**. With many concurrent visitors and active listing churn
      this fans out DB load per connected client. Consider debouncing,
      narrowing the subscription filter, or dropping live-refresh in favour of a
      manual/interval refresh on these list pages.
- [ ] **Shop pagination** (`pages/shop/ShopPage.jsx` ~line 35): hard
      `.limit(50)` with no pagination or total count. Fine now; revisit if the
      catalogue grows past 50 active products.

## P2 — Caching & resilience (code / infra)

- [ ] **Backend `ebayCache` is in-memory** (`src/utils/ebayCache.js`, a
      module-level `Map`). On Vercel it only survives an instance's warm window,
      so hit rates collapse under cold-start + fan-out and eBay upstream is hit
      far more than the TTL implies. A shared store (e.g. Upstash Redis) would
      make it effective across instances — worth it only if eBay pricing sits on
      a hot path during the spike.
- [ ] **Express rate limiters are in-memory** (`src/middleware/*rate-limit.js`,
      default `MemoryStore`). They are precision abuse throttles, not scale
      defence — each serverless instance keeps its own counters. Real protection
      is the Cloudflare edge rule (P0). Back them with a shared store only if you
      need app-layer limits to actually hold across instances.
- [ ] **Health endpoint is liveness-only** (`src/routes/health-check.js`
      returns `{ status: 'ok' }`; it does not probe Supabase connectivity or
      latency). Error visibility comes from Sentry (wired on both frontend and
      backend, `src/app.js`). Confirm Sentry alerting is on so a degrading
      Supabase surfaces during the spike.

## Already handled (no action)

- Frontend bundle: ~150 lazy-loaded routes in `App.jsx`, manual vendor chunk
  splitting and critical-CSS inlining in `vite.config.js`. Not a scale concern.
- `trust proxy` correctly resolves real visitor IPs behind Cloudflare
  (`src/app.js`, `src/utils/cloudflareIps.js`) so IP-keyed controls work.
- Immutable timestamped image uploads + service-worker client cache
  (`public/sw.js`) mean returning visitors generate near-zero image egress.

---

## Quick load test before the event

Point a load tester (k6 or Artillery) at the two hot pages under realistic
concurrency to find the actual break point *before* real traffic does:

- `GET /marketplace` and its listings query (paginated + filtered)
- `GET /shop`

Watch Supabase compute/egress in the dashboard while the test runs; that's the
metric that decides whether the site stays up.
