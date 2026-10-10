# Homepage performance (PageSpeed Insights)

How the homepage is built to load fast, and the reasoning behind the parts that
look odd. Measured with Lighthouse / PageSpeed Insights on `https://cardpop.com.au/`;
the CI lane is `.github/workflows/lighthouse.yml` (`lighthouserc.cjs`).

## How "/" paints

1. **Static shell.** `tools/home-shell.html` is injected into `index.html` at build
   (`homeShellPlugin` in `vite.config.js`) so the hero `<h1>` — the LCP element —
   the header, the announcement bar and the cookie banner all paint from HTML
   with the inlined critical CSS, before any JavaScript. React renders the same
   markup on its first commit (`HeroSection`, `Header`, `AnnouncementBar`,
   `CookieConsentBanner`), so the takeover moves nothing. Every other route is
   served the shell-less `app.html`.
2. **Paint first, then fetch.** The CSP bootstrap (`CSP_BOOTSTRAP`) injects the
   full stylesheet, the module preloads and the entry script *one frame after the
   first paint* (`requestAnimationFrame` → `setTimeout 0`; immediately in a hidden
   tab; 1.5 s safety timer). The paint needs none of those files, and Lighthouse's
   lab simulation (Lantern, which is what PSI reports) treats every High-priority
   script and VeryHigh-priority stylesheet whose request *started* before the
   observed first paint as render-blocking. With ~240 KB of preloads starting
   during HTML parse, simulated mobile FCP/LCP were 1.5 s / 2.7 s for a paint that
   needs only the 12 KB document. Real cost to visitors: one frame of JS boot.
   The bootstrap also removes the shell's announcement bar / cookie banner before
   first paint for visitors who already dismissed or decided them.
3. **Fonts.** Syne is self-hosted, preloaded (also via an Early Hints `Link`
   header in `vercel.json`) and declared `font-display: swap` with the
   metric-matched `Syne Fallback` face, so text is never invisible and the swap
   does not move the layout. Lighthouse's Font display insight flags
   `block`/`fallback`/`auto` alike — `fallback` was flagged on every mobile run.
4. **Data starts before React.** `lib/homepageData.js` holds the homepage's
   Supabase reads; `main.jsx` starts them the moment the bundle runs and
   `HomePage` joins the in-flight promises through `lib/queryCache.js`. The React
   mount used to be the critical path of every "Just Listed" photo. When the image
   CDN is configured the "/" document also preconnects to it (the end of that chain).

## Keeping third parties out of the measured window

Lighthouse stops tracing roughly a second or two after `load` once the page is
network- and CPU-quiet. Anything loaded "at idle" still lands inside that window
on a mid-range phone and is charged to Total Blocking Time, "Reduce unused
JavaScript", "Legacy JavaScript" and "Use efficient cache lifetimes" even though
the page never needed it. So every non-essential third party goes through
`lib/deferredLoad.js` → `onFirstInteractionOrLoad()`: first tap / key / scroll, or
`LOAD_FALLBACK_MS` (8 s) after `load` for a visitor who never interacts.

| Loader | What waits |
|---|---|
| `main.jsx` `initSentry` | `@sentry/react` (~47 KB gzip). Errors before init are buffered and replayed; the first error brings the SDK up immediately. |
| `main.jsx` `loadThirdPartyScripts` | gtag.js, Cloudflare beacon, Impact. The GA4 command queue is installed at boot so the landing page view is still recorded. |
| `lib/googleCustomerReviews.js` `scheduleBadgeLoad` | The Google reviews badge: its loader, iframe, scripts and Google-hosted font (the source of the "Font display", "Legacy JavaScript" and short-cache findings). |

AdSense never loads on the homepage (`NO_AD_PREFIXES` in `lib/adsense.js`).

## Main-thread work

- Below-the-fold homepage sections carry `.cv-auto` (`content-visibility: auto`,
  `index.css`) so style/layout/paint is skipped until they approach the viewport.
- Only one category-tile layout is rendered per viewport (`useMediaQuery` in
  `HomePage.jsx`) instead of both with one hidden by CSS.
- The desktop hero showcase shows its first card already settled; the shelf →
  stand flight runs from the second card on (it was keeping above-the-fold pixels
  changing for ~4 s after the hero painted — Speed Index).
- `tools/check-bundle-size.js` budgets the initial JS of **both** documents
  Vite emits — `index.html` ("/") and `app.html` (what Vercel serves for every
  other route) — each held to the same 320 KB gzip budget; the entry's largest
  pieces are `supabase-js` (~50 KB gzip, mostly unused at first paint but
  needed by every provider) and React itself.

## Images

- `LiveActivityTicker` and the card grids serve the 480 px companion thumbnail
  (`getCardImage().thumbSrc`) wherever an upload has one (`THUMBNAILS_SINCE`).
- Hero showcase uploads (Admin → Hero Showcase) go through
  `uploadShopImage(file, { prefix: 'hero-showcase' })`, which writes the
  `.opt.webp` + `.opt.thumb.webp` pair; rows created before that are converted
  with `node scripts/optimize-shop-images.mjs --table hero_showcase_cards --bucket media --apply`.
- Built-in hero cards (`HeroCardImage`) declare their real rendered width in
  `sizes` so 2× screens don't fetch the 720 w files for a 160 px slot.

## Checking a change

```bash
npm run build && npx vite preview --outDir dist --port 4173 &
npx lighthouse http://127.0.0.1:4173/ --only-categories=performance --output=json --output-path=lh.json
```

Local runs can't reach Supabase or the third parties, so compare lab metrics
relative to the previous build and confirm the live numbers on
[pagespeed.web.dev](https://pagespeed.web.dev/) after deploy.
