// Derive the static shell for app.html (every route except "/") from the
// homepage shell, so there is ONE copy of the header markup to keep in sync
// with components/Header.jsx.
//
// Before this, app.html was the bare Vite document: an empty <div id="root">
// behind a parser-blocking stylesheet. Nothing painted until the CSS and the
// entry JS had both arrived and React had mounted — mobile FCP 2.0–2.8 s and
// lab LCP 4–6 s on /marketplace, /shop and /events against 0.9 s / 1.4 s on
// "/" (EFFICIENCY_AUDIT_2026-10-10.md §3.1). The header is identical on every
// route and React's <Header/> renders the same markup on its first commit, so
// the homepage shell's chrome (announcement bar, header, cookie banner) can
// paint on every route; only the hero <main> is homepage-specific. It is
// swapped for the same markup <PageLoader/> renders — the Suspense fallback
// every lazy route shows first — so the takeover moves nothing.
//
// Pure string work, no DOM: it runs inside the Vite build plugin
// (vite.config.js homeShellPlugin) and in tests/frontend/homeShell.test.js.

// Mirrors components/PageLoader.jsx. Inert: the spinner is an inline copy of
// lucide's Loader2 path (lucide-react is not available at build time).
export const APP_SHELL_MAIN =
  '<main class="flex-grow flex flex-col">' +
    '<div class="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center bg-background">' +
      '<div class="flex flex-col items-center gap-4 animate-in fade-in duration-500">' +
        '<div class="relative">' +
          '<div class="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-primary animate-spin relative z-10" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>' +
        '</div>' +
        '<p class="text-muted-foreground font-medium tracking-wide text-sm">Loading content...</p>' +
      '</div>' +
    '</div>' +
  '</main>';

const MAIN_RE = /<main\b[^>]*>[\s\S]*?<\/main>/;

/**
 * Turn the homepage shell into the app shell: same announcement bar, header
 * and cookie banner, with the hero <main> replaced by the route loader.
 * Throws if the shell has no <main> — a silent fallback would ship the
 * homepage hero on every route.
 */
export function appShellFromHomeShell(homeShellHtml) {
  const stripped = homeShellHtml.replace(/<!--[\s\S]*?-->/g, '');
  if (!MAIN_RE.test(stripped)) {
    throw new Error('app-shell: tools/home-shell.html has no <main> element to replace');
  }
  return stripped.replace(MAIN_RE, APP_SHELL_MAIN);
}
