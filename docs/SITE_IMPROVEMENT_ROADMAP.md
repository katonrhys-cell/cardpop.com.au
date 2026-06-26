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
- [x] Bundle-size budget enforced in CI (`tools/check-bundle-size.js`, `check:bundle`, wired into ci + deploy verify) — initial JS now **276 KB gzip**, budget ratcheted 400→**300**
- [x] Deferred Sentry Session Replay via `lazyLoadIntegration` → **−37.7 KB gzip** off the critical path (error capture unaffected)
- [x] Confirmed opencv (11 MB) is lazy (not in the initial chunk) — only loads on scan flows
- [x] Evicted **framer-motion (~37 KB gzip)** from the initial load (313→276 KB, −12%):
      - root cause was a chunking artifact — forcing framer-motion into its own
        manual chunk made rolldown hoist a shared `react/jsx-runtime` helper into
        it, so the eager entry statically imported the whole motion chunk. Letting
        rolldown auto-split framer-motion + giving React core its own `vendor-react`
        chunk keeps animation code on-demand (loads with the pages that use it).
      - lazy-loaded the cart drawer (`ShoppingCartLazy.jsx`) — it was the only
        eager framer-motion importer; now mounts on first open (idle-prefetched),
        with an E2E test asserting it still opens.
- [~] `vendor-radix` (86 KB): investigated auto-splitting — only ~10 KB is
      lazy-only (Header's Sheet/Dialog + Button's Slot are genuinely eager), and
      dropping the manual chunk merged radix into `vendor-react` (worse caching).
      Left as-is; revisit if Header's Radix surface shrinks.
- [x] Image pipeline (homepage hero): the 5 hero cards display at 176 px but
      shipped 1024 px JPGs (~926 KB) and were downloaded even on phones (where
      they're `hidden`). Now AVIF/WebP/JPG at 360 w/720 w via `<picture>` +
      `sizes="176px"`, `loading="lazy"` + `fetchpriority="low"`, with originals
      moved out of `public/` to `tools/hero-sources/` (regen: `npm run optimize:images`).
      **Home: perf 84→89, LCP 1.82s→1.22s (−33%), TBT 64→2 ms**; Lighthouse's
      responsive-images (560 ms) + modern-formats (320 ms) opportunities now zero.
- [x] Image pipeline (listing/product images): `utils/imageUrl.js` `getCardImage()`
      builds responsive srcset URLs via Supabase Storage transforms (auto-WebP),
      wired into `CardImage` + the grid cards (Marketplace/Product/Vault) and the
      detail-page `ProductImageCarousel` (main image eager/high-priority + a
      full-res original kept for the zoom microscope; thumbnails at 80/160 w).
      Transforms are a paid feature, so it **degrades gracefully**: `CardImage`
      swaps to the untransformed original on error and a session flag stops
      retrying transforms (≤1 wasted request if the feature is off). Tested
      (`imageUrl.test.js`, `cardImage.test.jsx`).
      ⚠️ Not measured in-sandbox — Supabase egress is blocked here, so the
      marketplace renders empty; the real LCP/bytes win needs a populated env.
- [x] Lighthouse CI measuring LCP / TBT / CLS + a11y/SEO/best-practices on every
      PR (`lighthouserc.cjs`, `npm run lhci` / `lhci:mobile`,
      `.github/workflows/lighthouse.yml` — **desktop + mobile matrix**). Budgets
      calibrated per form factor; CLS + a11y are hard `error` gates, perf/LCP/
      TBT/SEO are `warn`. INP isn't measurable in a lab run — TBT is its proxy.
      **Desktop baseline (median of 3):**
      | Route | Perf | A11y | SEO | LCP | TBT | CLS |
      |---|---|---|---|---|---|---|
      | `/` | 84 | 98 | 92 | 1.82s | 64ms | 0.011 |
      | `/marketplace` | 93 | 98 | 92 | 0.94s | 3ms | 0.007 |
      | `/shop` | 90 | 98 | 92 | 0.91s | 6ms | 0.005 |
      | `/login` | 99 | 98 | 66* | 0.90s | 0ms | 0.003 |

      **Mobile baseline (Moto-G4 + slow-4G + 4× CPU, median of 3):**
      | Route | Perf | LCP | FCP | TBT | CLS |
      |---|---|---|---|---|---|
      | `/` | 70 | 5.08s | 3.44s | 192ms | 0.070 |
      | `/marketplace` | 77 | 4.02s | 3.47s | 141ms | 0.070 |
      | `/shop` | 71 | 3.87s | 3.40s | 160ms | 0.070 |
      | `/login` | 80 | 3.90s | 3.33s | 107ms | 0.002 |

      *login is intentionally `noindex` — excluded from the SEO assertion.
      a11y holds at 98 on mobile too. Note: marketplace/shop can't load real
      data in the sandbox (Supabase egress blocked) so their content metrics are
      shell-only; home is the representative number.
- [ ] **Mobile backlog** (from the pass above — throttled mobile is the real
      bottleneck; desktop is already strong):
      - Render-blocking CSS ≈ **761 ms** on mobile (the 195 KB/30 KB-gz Tailwind
        bundle blocks first paint) → biggest FCP lever. Needs critical-CSS
        extraction or SSR/edge HTML; an architectural item, not a quick fix.
      - unused-CSS ≈220 ms + unused-JS ≈310 ms on home; mobile FCP ~3.4s is the
        shell cost (SPA renders client-side).
      - Mobile CLS 0.070 (under the 0.1 gate but worth chasing once content loads).
- [ ] Consider moving opencv card-detection into a Web Worker (off main thread)

### 6. Trust & safety (the actual marketplace product)
- [~] Card authentication / grading verification. **AUDIT:** the PSA client is
      real (`api.psacard.com`), but verification was (a) view-time only, not bound
      to the listing, and (b) `verified = !!details` — it only checked the cert
      **exists**, never that the **claimed grade matched it**. So a genuine PSA 9
      cert could be relabelled "PSA 10" and still render "Verified by CardPop…
      accuracy of the grade confirmed" (a false claim + a real scam vector).
      - **Done:** grade-match enforcement. `verifyGradingNumber` now extracts the
        cert's real grade and compares it to the seller's claimed grade
        (`gradeMatch`: true / false / null-inconclusive). `/verify` accepts
        `expectedGrade`; `GradingVerificationSection` shows a red **"Grade
        mismatch"** warning (and withholds the verified badge) when the claim
        contradicts the cert, only confirms the grade when it actually matches,
        and softens copy when inconclusive. Tests: service grade-match unit +
        route passthrough + component states.
      - **Next (needs schema + listing-flow change):** verify at listing-creation
        time and persist a tamper-proof `grade_verified` on the vault_item (RLS:
        clients can't self-set it), so grids/badges reflect stored truth and
        high-value graded listings can require a passing check before going live.
        Beckett verification is still a stub (`not yet implemented`).
- [ ] Seller vetting / tiers / verification badges — define and enforce
- [~] Dispute resolution + escrow: **AUDIT FINDING — the "escrow" claim was
      false.** `src/routes/stripe.js` transfers seller proceeds (Stripe Connect
      transfer or wallet credit) on `checkout.session.completed` — i.e. the
      instant payment succeeds, with **no hold until delivery**. The homepage /
      About / Trust&Safety pages claimed "escrow… funds release only when both
      parties are satisfied," which is misleading (Australian Consumer Law risk).
      - **Done now:** corrected all user-facing copy to describe what actually
        exists — secure Stripe payments + the 14-day **Buyer Protection**
        refund flow (no "escrow"/"funds held" language).
      - **Decision needed (real escrow is a build):** hold funds until delivery
        confirmation. Options: Stripe manual-capture / separate charges &
        transfers with a delayed transfer, or hold in the platform balance and
        transfer on buyer confirmation / auto-release after N days. Pair with a
        dispute state machine (open → evidence → resolve) — the refunds table +
        admin approval is the seed.
- [~] Counterfeit / scam **reporting flow** — was entirely missing (the
      `ModerationPanel` was just admin notes on catalog cards). Added an
      end-to-end vertical slice:
      - `content_reports` table (`supabase/migrations/20260626000001_*.sql`) —
        RLS denies client reads (reports are accusations); writes go only via the
        backend; unique partial index enforces one open report per reporter/target.
        ⚠️ **Migration must be applied** (Supabase CLI/dashboard) before the
        endpoint works in prod.
      - `POST /reports` (auth + per-user rate limit `reportLimiter` 10/hr +
        app-layer de-dupe) and admin `GET/PATCH /reports` to triage the queue
        (`src/routes/reports.js`, 16 backend tests).
      - `ReportModal.jsx` + a "Report this listing" control on the marketplace
        listing page (4 frontend tests). Reusable for users/reviews/events.
      - Admin moderation queue (`pages/admin/ReportsModerationPage.jsx`,
        `/admin/reports`, linked from the dashboard) — reads/triages via the
        backend (RLS denies client reads), high-risk reasons flagged, deep-links
        to the reported target (4 frontend tests).
      - Auto-escalation: when a target reaches 3 **distinct** open reports the
        backend notifies all admins (`report_escalation` notification). No
        auto-takedown (that would be a brigading vector) — moderators decide.
      - **Next:** wire report buttons onto cards/seller profiles/reviews.
- [~] Chargeback & fraud handling; velocity limits on new accounts.
      - **Done:** new-account **purchase velocity** guard (`src/utils/purchaseVelocity.js`)
        wired into both server-side checkout endpoints (`/create-checkout`,
        `/create-cart-checkout`). Unverified accounts < 7 days old are capped at
        $1,500/order, 5 orders/24h and $3,000 spend/24h (failed/refunded orders
        don't count); verified or older accounts are unrestricted; the check
        **fails open** so an outage never blocks all payments. 429 +
        `velocity_limit` code with a "verify your identity to lift this" message.
        8 backend tests.
      - **Chargeback handling DONE:** `charge.dispute.created` / `closed` webhooks
        (`src/services/disputeService.js`) now freeze the order payout
        (`payout_status='frozen'`), reverse an already-sent Stripe transfer or
        claw back a wallet credit, record the dispute in `payment_disputes`
        (migration `20260626000002`), and notify admins + the seller. All
        best-effort/never-throws so the webhook always ack's. ⚠️ migration must be
        applied. 5 tests.
      - **Disputes admin queue DONE:** `GET/PATCH /admin/disputes` +
        `pages/admin/DisputesAdminPage.jsx` (`/admin/disputes`, linked from the
        dashboard). Admins see open disputes + $ at risk and either **release**
        the frozen payout (pays the seller via the shared `payoutSeller` helper —
        extracted from the webhook so both paths share one implementation) or
        **keep it frozen**. 10 tests (payout helper, admin endpoints, UI).
      - **Next:** listing-creation velocity is still open — listings are created
        client-side (`supabase.from('listings').insert`), so a new account can
        spam scam listings. Needs a backend listing endpoint or RLS rate rules.
- [ ] Clear, enforced policies (returns, authenticity guarantee, prohibited items)

---

## Tier 3 — Compounding quality

### 7. Accessibility
- [x] Added axe to the test stack on **two** layers: `vitest-axe` unit checks
      (`tests/frontend/a11y.test.jsx` — UI primitives, Footer, Breadcrumb, login
      form, BuyerProtection) and `@axe-core/playwright` real-browser audits
      (`e2e/a11y.spec.js` — home, marketplace, shop, login; fails the build on
      serious/critical WCAG 2.0–2.2 A/AA violations, attaches full report)
- [x] Colour-contrast pass against brand colours — fixed real AA failures the
      audit surfaced:
      - `--muted-foreground` was **4.1:1** on white (139 nodes site-wide) →
        darkened light 50%→43% / lightened dark 60%→64% (now ≥4.8:1); same fix
        for `--seo-breadcrumb-text`
      - Home activity marquee: red price pill (2.1:1) → solid brand-red pill with
        white text (5.5:1); faint timestamps `/40`→`/70` (6.2:1)
      - Marketplace error state: `opacity-80` red text (4.05:1) → full destructive
        red (5.1:1)
- [x] ARIA names — gave every marketplace/shop filter `Select` combobox and the
      icon-only refresh button an `aria-label` (axe `button-name` was critical:
      comboboxes need an explicit label, not just placeholder text)
- [ ] Manual audit of keyboard nav + focus management on key flows (search,
      listing, checkout) — axe catches ~30–50%; the rest needs hands-on testing
- [ ] Extend the axe E2E sweep to authenticated/checkout pages once seeded
- [x] AU DDA / WCAG 2.2 AA target — encoded as the `withTags` set in the E2E spec

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
