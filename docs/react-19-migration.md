# React 19 migration — scope

Status: **not started**. This is a scoping document, not a runbook.

The app is on React 18.3.1. This note records what a React 18 → 19 upgrade
actually involves, gathered by auditing the dependency tree and the codebase.
The headline: the work is **much smaller than the file count suggests** — only
two packages block the upgrade, and the codebase uses none of the APIs React 19
removed. Most of the effort is verification, not code changes.

## Why you'd do it

Not for security. The open `react-router` advisory
([GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2))
only affects apps using the unstable RSC APIs; this app is a declarative-mode
SPA (`BrowserRouter` in `App.jsx`) and is not affected. See
"React Router v8" below.

The real reasons are ecosystem drift (new library majors are increasingly
React-19-only, as `react-leaflet@5` already is) and access to React 19 features
— native `<title>`/`<meta>` hoisting, `use()`, ref-as-prop, improved Suspense.

## Blockers: two packages

Of the 48 React-coupled dependencies, **45 already declare React 19 support** —
including all 27 `@radix-ui/*` packages, `sonner`, `cmdk`, `vaul`,
`framer-motion`, `recharts`, `react-hook-form`, `@sentry/react`,
`@stripe/react-stripe-js`, `next-themes`, `input-otp`, `embla-carousel-react`,
`react-day-picker`, `react-resizable-panels`, `@vercel/analytics`,
`@vercel/speed-insights` and `@testing-library/react`.

Only two need moving:

| Package | Installed | Target | Notes |
|---|---|---|---|
| `react-helmet-async` | 1.3.0 | **3.0.0** | Peer is `^16.6.0 \|\| ^17 \|\| ^18 \|\| ^19`. Same named exports (`Helmet`, `HelmetProvider`, `HelmetData`) — the 52 import sites need no change. Not deprecated; same upstream repo. |
| `react-leaflet` | 4.2.1 | **5.0.0** | Peer is `react ^19.0.0` — a hard React 19 requirement, so it must move in the same commit. Used in exactly one file: `pages/community/LocalMapPage.jsx`. |

Because `react-helmet-async@3` still supports React 18, it can be bumped
*first*, on its own, and verified before React itself moves. That splits the
risk in two. `react-leaflet@5` cannot — it requires 19.

## Codebase readiness: clean

React 19 removes a set of long-deprecated APIs. The codebase (416 `.jsx` files)
uses **none of them**:

| Removed in React 19 | Present? |
|---|---|
| `defaultProps` on function components | No |
| `propTypes` / `prop-types` | No |
| `ReactDOM.render` / `hydrate` / `unmountComponentAtNode` | No — already `createRoot` (`main.jsx:84`) |
| `findDOMNode` | No |
| Legacy context (`contextTypes` / `childContextTypes`) | No |
| String refs (`ref="name"`) | No |
| `react-test-renderer` / `react-dom/test-utils` | No |
| `useFormState` (renamed `useActionState`) | No |

Also relevant and fine as-is:

- One class component, `components/ErrorBoundary.jsx`. Class components and
  `getDerivedStateFromError` are still supported.
- 43 files use `forwardRef`. Still works in React 19 (ref-as-prop is the new
  way, but `forwardRef` is not removed). Optional cleanup, not migration work.
- No `react-dom/server` usage anywhere — `api/prerender.js` builds its bot HTML
  as strings by hand, so the crawler path is entirely unaffected by the React
  version.
- No TypeScript (no `tsconfig.json`), so the `@types/react` 18 → 19 bump is
  low-consequence; it only affects editor tooling.

## Where the actual risk is

Three areas need real verification rather than a green test run.

**1. The homepage shell / critical-CSS pipeline.** This is the highest-risk
piece by some distance. `vite.config.js` injects `tools/home-shell.html` inside
`<div id="root">` of the `/`-only `index.html`, inlines critical CSS, and
`main.jsx` gates the React mount on the async stylesheet loading (with a 2s
fail-safe). React then renders over that static markup and must take over with
no visible header change and no layout shift. None of that is hydration — it's
a client render that clears the container, which behaves the same in 19 — but
the LCP timing is tuned around it. Verify visually and with the existing
`lighthouse.yml` workflow, not just by checking the page loads.

**2. Suspense sibling pre-warming.** React 19 changes what happens when a
component suspends: siblings are now pre-warmed. Every route in `App.jsx` is
lazy-loaded, and `main.jsx` wraps `Analytics`/`SpeedInsights` in their own
`Suspense` boundaries. Worth confirming this doesn't change which chunks get
pulled during a route transition — it interacts with the route-preload logic in
`vite.config.js`.

**3. Error handling reaching Sentry.** React 19 no longer rethrows uncaught
render errors; it routes them through `onUncaughtError` / `onCaughtError` on
`createRoot`. `@sentry/react@10.57.0` supports React 19, but confirm errors
still arrive in Sentry with a deliberate throw rather than assuming it.

A lesser one: React 19's native `<title>`/`<meta>` hoisting does **not** dedupe
against the static tags already in `index.html:124-139`. That only matters if
you later drop `react-helmet-async` in favour of native metadata — Helmet's
override semantics are what currently keep the page from having two `<title>`
tags and two canonicals. Bumping Helmet to v3 avoids this entirely; removing
Helmet is a separate project with a real SEO regression risk.

## Suggested sequencing

0. **`react-helmet-async` 1.3.0 → 3.0.0 alone, still on React 18.** Verify
   green. Isolates the one dependency that can be de-risked independently.
1. **`react` + `react-dom` + `@types/react` + `@types/react-dom` → 19, and
   `react-leaflet` → 5.0.0** in one commit (leaflet requires 19).
2. **`npm run lint` + `npm test`** (90 frontend test files). Expect little
   fallout given the audit above; `act()` warning shapes may differ.
3. **Verify the three risk areas** — home-shell visual + Lighthouse, route
   transitions, Sentry capture.
4. **Vercel preview deploy.** Check the bot/prerender path is untouched (it
   should be — no `react-dom/server`).

Node is not a constraint: `engines` is `>=22`, CI runs 24.

## React Router v8, afterwards

Once React 19 lands, `react-router` v8 becomes available (it requires
`react >=19.2.7`). Two things to know:

- **There is no `react-router-dom` v8** — the package stops at 7.18.2 and v8
  consolidated into `react-router`. The upgrade means rewriting the import
  specifier in **177 files**. Mechanical, but a large diff.
- The app's router surface is entirely the stable declarative core — `Link`
  (114 uses), `useNavigate` (46), `useParams` (26), `useSearchParams` (14),
  `useLocation` (14), `MemoryRouter` in tests (14), `Navigate` (8),
  `Routes`/`Route` (6 each), `Outlet` (2), one `BrowserRouter`. No loaders,
  actions, fetchers, `createBrowserRouter`, or RSC — so nothing v8 changes is
  in use.

Treat it as a follow-on, not part of this migration.
