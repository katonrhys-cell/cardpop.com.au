// Impact affiliate tracking (utt.impactcdn.com). It rewrites outbound
// affiliate links and records impressions — marketing tracking, so it waits
// for the visitor to accept marketing cookies (lib/consent.js), exactly like
// the Meta Pixel and Google Ads. It used to load on every page for everyone,
// checkout and admin included. It is also never started on the pages that
// carry no affiliate links and handle money or credentials.
//
// Injected from JS because the `strict-dynamic` CSP blocks markup-inserted
// third-party tags; the host is allow-listed in lib/trustedTypesPolicy.js.

import { hasMarketingConsent, onConsentChange } from '@/lib/consent.js';

export const IMPACT_SCRIPT_SRC = 'https://utt.impactcdn.com/P-A7361090-8367-4d02-a53d-c4f13bef08391.js';

// Path prefixes Impact never starts on.
export const NO_IMPACT_PREFIXES = ['/checkout', '/login', '/signup', '/admin', '/account', '/welcome', '/reset-password'];

export const impactAllowedOn = (pathname = '') =>
  !NO_IMPACT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

let installed = false;

function installImpact() {
  if (installed || typeof window === 'undefined') return;
  if (!impactAllowedOn(window.location?.pathname)) return;
  installed = true;
  try {
    (function (i, m, p, a, c, t) {
      c.ire_o = p; c[p] = c[p] || function () { (c[p].a = c[p].a || []).push(arguments); };
      t = a.createElement(m); const z = a.getElementsByTagName(m)[0];
      t.async = 1; t.src = i; z.parentNode.insertBefore(t, z);
    })(IMPACT_SCRIPT_SRC, 'script', 'impactStat', document, window);
    window.impactStat('transformLinks');
    window.impactStat('trackImpression');
  } catch { /* affiliate tracking is non-critical */ }
}

/** Call once after the app is interactive. Installs now if consented, else on consent. */
export function initImpactTag() {
  if (typeof window === 'undefined') return;
  if (hasMarketingConsent()) installImpact();
  else onConsentChange((v) => { if (v === 'all') installImpact(); });
}

// Test hook.
export const __resetImpactForTests = () => { installed = false; };
