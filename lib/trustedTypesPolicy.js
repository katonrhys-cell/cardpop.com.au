// Default Trusted Types policy — the browser routes every string assigned to a
// DOM XSS sink (innerHTML, script src, Worker URLs, …) through this policy once
// the CSP enforces `require-trusted-types-for 'script'` (see vercel.json).
//
// Must be imported before any code that touches a sink, so it is the first
// import in main.jsx. Known sinks in this app:
//   • dangerouslySetInnerHTML — MFA QR code SVG, blog article HTML, chart <style>
//   • navigator.serviceWorker.register('/sw.js')
//   • gtag / Impact loader script.src (main.jsx)
//   • Sentry Replay's compression Worker (blob: URL)
//   • react-helmet-async setting the text of <script type="application/ld+json">
//     tags (SEOHead structured data) — a script-text sink
import DOMPurify from 'dompurify';

// Mirrors the script-src host allowlist in vercel.json — a script URL that CSP
// would block anyway gains nothing from passing Trusted Types.
const ALLOWED_SCRIPT_HOSTS = new Set([
  'www.googletagmanager.com',
  'www.google.com',
  'www.gstatic.com',
  'maps.googleapis.com', // Google Maps JS API (Places autocomplete at checkout)
  'maps.gstatic.com',    // sub-scripts the Maps JS API injects
  'challenges.cloudflare.com',
  'static.cloudflareinsights.com', // Cloudflare Web Analytics beacon (main.jsx)
  'js.stripe.com',       // Stripe.js — Embedded Checkout loads dahlia/stripe.js
]);

function isAllowedScriptUrl(url) {
  let parsed;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    return false;
  }
  if (parsed.protocol === 'blob:') return true; // same-page blobs (Sentry worker)
  if (parsed.origin === window.location.origin) return true;
  return (
    parsed.protocol === 'https:' &&
    (ALLOWED_SCRIPT_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.impactcdn.com'))
  );
}

if (typeof window !== 'undefined' && window.trustedTypes?.createPolicy) {
  try {
    window.trustedTypes.createPolicy('default', {
      // dangerouslySetInnerHTML values get sanitized. ADD_ATTR keeps the
      // target="_blank" links that blog articles rely on (they pre-sanitize
      // with the same option — see BlogArticlePage). Note: DOMPurify
      // serializes as markup, so raw "<" in non-HTML payloads (e.g. CSS text
      // set on a <style> via dangerouslySetInnerHTML) would be mangled — keep
      // such payloads free of angle brackets.
      createHTML: (html) => DOMPurify.sanitize(html, { ADD_ATTR: ['target'] }),
      createScriptURL: (url) => {
        if (isAllowedScriptUrl(url)) return url;
        throw new TypeError(`Blocked script URL by Trusted Types default policy: ${url}`);
      },
      // eval()/new Function() are already blocked by CSP (no 'unsafe-eval');
      // keep Trusted Types consistent with that — except for pure JSON.
      // react-helmet-async writes JSON-LD <script> contents through this sink,
      // and the JSON grammar has no identifiers or calls, so a JSON payload is
      // inert even if a script element were to execute it.
      createScript: (code) => {
        const text = String(code);
        try {
          JSON.parse(text);
          return text;
        } catch {
          throw new TypeError(`Blocked eval-like script by Trusted Types default policy: ${text.slice(0, 80)}`);
        }
      },
    });
  } catch {
    // Policy already exists (double import in dev/HMR) — the first one wins.
  }
}
