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
- [ ] Run Supabase **security advisors** and fix every finding (missing RLS, SECURITY DEFINER views, etc.)
- [ ] Audit RLS policies table-by-table (profiles, listings, vault_items, orders, trades, wallets, addresses)
- [ ] Pen-test authz on trade / vault / wallet / payment endpoints (can user A act on user B's data?)
- [ ] Verify the service-role key is never reachable client-side; rotate if ever exposed
- [ ] Secrets hygiene: confirm all secrets are in Vercel/Actions secrets, none committed
- [ ] Enable Supabase leaked-password protection + MFA enforcement options
- [ ] Security headers / CSP review in production (helmet config vs. real responses)

### 3. End-to-end testing
- [ ] Stand up Playwright (already pre-installed in this env)
- [ ] E2E: sign up → verify → list a card → appears in marketplace
- [ ] E2E: add to cart → checkout → Stripe session (test mode)
- [ ] E2E: propose trade → accept → both parties notified
- [ ] Run E2E against Vercel preview deploys in CI

---

## Tier 2 — Blocks "world-class"

### 4. SEO & rendering (SPA ceiling)
- [ ] Decide: prerender (cheap) vs SSR/meta-framework migration (big) — the app is currently a CSR SPA
- [ ] JSON-LD structured data for listings (Product/Offer), org, breadcrumbs
- [ ] Per-listing meta/OG tags rendered for crawlers
- [ ] Validate sitemaps are submitted + indexed; robots.txt correct
- [ ] Canonical URLs, pagination handling for category pages

### 5. Performance / Core Web Vitals
- [ ] Add a bundle-size budget to CI; track over time
- [ ] opencv (11 MB) — confirm it only loads on scan flows; consider WASM/worker + smaller model
- [ ] Image pipeline: responsive sizes, AVIF/WebP, lazy-load, CDN; audit largest LCP images
- [ ] Measure + set budgets for LCP / INP / CLS (Lighthouse CI)
- [ ] Route-level code splitting audit; preload critical chunks

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
