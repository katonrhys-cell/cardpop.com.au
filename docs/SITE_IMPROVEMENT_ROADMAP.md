# CardPop — Site Improvement Roadmap

A living, critical assessment of what stands between CardPop and being the best
trading-card marketplace in the world. Worked through methodically; check items
off as they land. Ordered roughly by leverage (each early item de-risks later ones).

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Tier 1 — Foundational / quietly dangerous

### 1. CI/CD rigor — make the tests protect production
- [x] CI workflow runs lint + full test suite + build on every PR (`.github/workflows/ci.yml`)
- [x] Deploy gated on lint + tests + build passing (`deploy.yml` `deploy` needs `verify`)
- [ ] Enable the `verify` job as a **required status check** in branch protection (GitHub setting — repo owner)
- [ ] Add coverage reporting to CI (upload + PR comment) and a ratchet so coverage can't drop
- [ ] Cache the build, run tests sharded if CI time grows

### 2. Security — money + PII marketplace
- [x] Code-level authz audit → `docs/SECURITY_AUDIT.md` (backend routes: PASS; frontend direct-DB: 85 sites / ~25 tables, RLS-only)
- [~] Identified 3 critical escalation candidates: `profiles.is_admin`, `user_verifications.status`, `refunds.status` (admin-gated in UI only — RLS unverified)
- [ ] Run Supabase **security advisors** + the verification SQL in the audit (needs live-DB access/approval)
- [x] App-layer hardening: moved is_admin / verification-approval / refund-approval to admin-checked backend endpoints (`src/routes/admin.js`) + repointed admin UI (defence in depth)
- [ ] DB-layer hardening: apply the RLS template in SECURITY_AUDIT.md §4b so clients can't write those fields directly (needs live-DB access)
- [ ] Column-level protection on `profiles` (is_admin, tier, rating, balances)
- [ ] Add RLS regression tests (sign in as normal user, assert escalation writes rejected)
- [ ] Audit remaining sensitive tables (orders, listings, offers, taxonomy) for admin/ownership RLS
- [ ] Verify the service-role key is never reachable client-side; rotate if ever exposed
- [ ] Enable Supabase leaked-password protection + MFA enforcement options
- [ ] Confirm `POST /resend-verification` (unauthenticated) is rate-limited
- [ ] Security headers / CSP review in production (helmet config vs. real responses)

### 3. End-to-end testing
- [x] Stand up Playwright (`playwright.config.js`, `e2e/`, `test:e2e` script)
- [x] Real-browser smoke suite against the production build: app boots, marketplace/shop routes render, login form shows, no uncaught errors
- [x] E2E CI workflow (`.github/workflows/e2e.yml`, runs on PRs)
- [ ] Authenticated flows (need a seeded test env + backend): sign up → list → marketplace
- [ ] add to cart → checkout → Stripe session (test mode)
- [ ] propose trade → accept → both parties notified
- [ ] Run E2E against Vercel preview deploys (vs. local build) for true prod parity

---

## Tier 2 — Blocks "world-class"

### 4. SEO & rendering (SPA ceiling)
- [x] SEO assessment written (`docs/SEO_ASSESSMENT.md`) — current state + rendering options + recommendation
- [x] Product/Offer + BreadcrumbList JSON-LD on the main MarketplaceListingPage (was missing) + canonical + og:image
- [x] Confirmed strong static head meta, WebSite+SearchAction / Organization / OnlineStore JSON-LD, robots.txt, served sitemap
- [ ] **Decision needed**: rendering strategy for dynamic pages (edge meta injection vs prerender vs SSR) — see assessment §Options
- [ ] Category pages: ItemList/CollectionPage JSON-LD + unique meta
- [ ] Per-listing dynamic OG images
- [ ] Submit sitemap in Search Console; monitor coverage + CWV
- [ ] Verify with Google Rich Results Test / URL Inspection

### 5. Performance / Core Web Vitals
- [x] Bundle-size budget enforced in CI (`tools/check-bundle-size.js`, `check:bundle`, wired into ci + deploy verify) — initial JS now **313 KB gzip** (budget 400)
- [x] Deferred Sentry Session Replay via `lazyLoadIntegration` → **−37.7 KB gzip** off the critical path (error capture unaffected)
- [x] Confirmed opencv (11 MB) is lazy (not in the initial chunk) — only loads on scan flows
- [ ] Further trims: split/lazy `vendor-radix` (86 KB) and `vendor-motion` (37 KB) below-the-fold
- [ ] Image pipeline: responsive sizes, AVIF/WebP, lazy-load, CDN; audit largest LCP images
- [ ] Measure + set budgets for LCP / INP / CLS (Lighthouse CI)
- [ ] Consider moving opencv card-detection into a Web Worker (off main thread)

### 6. Trust & safety (the actual marketplace product)
- [ ] Card authentication / grading verification — is PSA/Beckett check enforced on high-value listings?
- [ ] Seller vetting / tiers / verification badges — define and enforce
- [ ] Dispute resolution + escrow: is buyer money actually held until delivery confirmed?
- [ ] Counterfeit / scam detection signals; reporting flow
- [ ] Chargeback & fraud handling; velocity limits on new accounts
- [ ] Clear, enforced policies (returns, authenticity guarantee, prohibited items)

---

## Tier 3 — Compounding quality

### 7. Accessibility
- [ ] Add axe (jest-axe / @axe-core/playwright) to the test stack
- [ ] Audit keyboard nav, focus management, ARIA on key flows (search, listing, checkout)
- [ ] Colour-contrast pass against brand colours
- [ ] AU DDA / WCAG 2.2 AA target

### 8. Test coverage gaps
- [ ] `components/` (29%) — cover the high-traffic ones (cards, forms, modals)
- [ ] `pages/` (37%) — promote more smoke tests to interaction tests
- [ ] `src/api/integrated-ai.js` (5%) — the AI streaming core
- [ ] `lib/` clients (41%) — apiServerClient, supabaseClient wrappers, integratedAiClient
- [ ] Re-host the 4 quarantined page smoke tests with proper fixtures

### 9. Observability & reliability
- [ ] Uptime monitoring on `/health` with alerting
- [ ] Confirm Sentry captures both frontend + backend, with release tracking & source maps
- [ ] Define SLOs / error budget; dashboard for key funnels
- [ ] Structured logging + log retention; alert on error-rate spikes

### 10. Scalability
- [ ] DB index review for hot queries (listings search, market data)
- [ ] Caching strategy (eBay/CardSight responses, category tree, pricing)
- [ ] Serverless cold-start mitigation; function size/timeout review
- [ ] Rate-limit headroom vs. eBay/CardSight quotas as volume grows

### 11. Payments & compliance (AU)
- [ ] Stripe Connect payout correctness + reconciliation tests
- [ ] AU GST handling + invoicing
- [ ] Refund / partial-refund / chargeback flows end-to-end
- [ ] PCI scope confirmation (Stripe-hosted = minimal, verify no card data touches us)

### 12. Growth & marketplace dynamics
- [ ] Two-sided cold-start: seed liquidity, seller onboarding funnel
- [ ] Search quality & discovery (relevance, filters, "did you mean", trending)
- [ ] Retention: notifications, watchlist alerts, price drops, saved searches
- [ ] Mobile experience parity (most card buyers are on phones)
- [ ] Analytics: funnel instrumentation to know where users drop

---

## Hostinger decommission (carry-over)
- [ ] Re-host the 12 CDN images in `data/events.js` + `AddYourFirstCardPage.jsx`
      (blocked in agent env — `horizons-cdn.hostinger.com` egress denied; needs the
      image files supplied, then references repointed to local/Supabase Storage)
