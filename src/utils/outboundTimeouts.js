// How long the backend waits on each third party before giving up.
//
// Every outbound `fetch` carries `signal: AbortSignal.timeout(...)` from this
// table (tests/backend/outboundTimeouts.test.js fails on one that doesn't).
// Without it a stalled upstream holds the Vercel function until its own
// 40 s limit, so the caller gets a 504 with no error anywhere, the function
// is billed for the whole wait, and under load the stalled invocations crowd
// out healthy requests. Each budget is set from what the call is for: a
// CAPTCHA check on a sign-up form has a few seconds, a model call on a 300 s
// cron function has minutes. Untrusted URLs go through src/utils/safeFetch.js,
// which carries its own timeout and SSRF guard.

export const OUTBOUND_TIMEOUT_MS = Object.freeze({
  // Cloudflare Turnstile / Google reCAPTCHA siteverify — on the sign-up and
  // contact paths; a slow answer here blocks a human, so fail fast and closed.
  verify: 8_000,
  // Amazon Location geocode — the checkout critical path.
  geocode: 6_000,
  // Have I Been Pwned range lookup — the password form waits on it.
  hibp: 5_000,
  // Kit.com subscribe.
  newsletter: 10_000,
  // eBay OAuth + Browse API — also the price cron, which has 25 s for many calls.
  ebay: 10_000,
  // PSA public API (retried up to 3× by its caller) and the scraper fallback.
  psa: 8_000,
  // PayPal REST (token, subscriptions, webhook verification).
  paypal: 15_000,
  // USD→AUD rate (exchangerate-api.com); cached for hours, so fail fast.
  exchangeRate: 6_000,
  // The streaming AI proxy behind the chat and OCR routes, on the 40 s function.
  aiProxy: 35_000,
  // Anthropic SDK clients (`new Anthropic({ timeout })`), per function budget.
  anthropicShort: 20_000, // supplier price read, inside the 40 s function
  anthropicGrade: 150_000, // grade estimator vision stream (two photos), api/grade-estimate.js's 300 s function
  anthropicScan: 180_000, // event scan / page extraction, 300 s function
  anthropicDraft: 240_000, // blog draft stream, 300 s function
  // Stripe SDK (`new Stripe(key, { timeout })`); Stripe's default is 80 s.
  stripe: 20_000,
});

/** Shorthand for the per-call signal. */
export const timeoutSignal = (ms) => AbortSignal.timeout(ms);
