// Cookie / tracking consent.
//
// GA4 runs as first-party analytics regardless (it is configured with Google
// Consent Mode v2 defaults that deny ad storage), but the advertising tags —
// Google Ads conversion tracking and the Meta Pixel — only load after the
// visitor accepts marketing cookies in the banner (components/CookieConsentBanner.jsx).
// The choice lives in localStorage so it survives reloads; nothing is sent
// anywhere until a choice is made.

export const CONSENT_STORAGE_KEY = 'cardpop_cookie_consent';
export const CONSENT_ALL = 'all';
export const CONSENT_ESSENTIAL = 'essential';

const listeners = new Set();

/** 'all' | 'essential' | null (no decision yet). */
export function getConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === CONSENT_ALL || v === CONSENT_ESSENTIAL ? v : null;
  } catch {
    return null;
  }
}

export const hasMarketingConsent = () => getConsent() === CONSENT_ALL;

export function setConsent(value) {
  if (value !== CONSENT_ALL && value !== CONSENT_ESSENTIAL) throw new Error(`Unknown consent value: ${value}`);
  try { window.localStorage.setItem(CONSENT_STORAGE_KEY, value); } catch { /* private mode */ }
  for (const fn of listeners) {
    try { fn(value); } catch { /* a listener must never break the others */ }
  }
}

/** Forget the choice so the banner shows again ("Cookie settings" in the footer). */
export function resetConsent() {
  try { window.localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(null); } catch { /* ignore */ }
  }
}

/** Subscribe to consent changes; returns an unsubscribe function. */
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
