/**
 * Return-URL allow-list for hosted payment flows.
 *
 * Stripe Checkout, Stripe Connect onboarding and PayPal all take a URL to send
 * the customer back to afterwards. Those URLs used to be accepted verbatim from
 * the request body, so an attacker could create a Checkout Session (branded
 * CardPop, on checkout.stripe.com) whose success_url pointed at their own site
 * and hand the link to a victim: after a real payment the victim lands on an
 * attacker page carrying the `session_id` — a convincing "confirm your card"
 * phishing step on the back of a genuine purchase.
 *
 * A return URL must now be https/http, and its origin must be the app's own:
 *   - APP_URL (default https://cardpop.com.au)
 *   - any origin listed in CORS_ORIGIN
 *   - Vercel's own deployment URLs (VERCEL_URL / VERCEL_BRANCH_URL) so preview
 *     deployments keep working
 *   - CHECKOUT_RETURN_ORIGINS — optional comma-separated extras
 *   - localhost on any port outside production
 */
function normaliseOrigin(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).origin;
  } catch {
    return null;
  }
}

export function allowedReturnOrigins() {
  const origins = new Set();
  const add = (v) => { const o = normaliseOrigin(v); if (o) origins.add(o); };
  add(process.env.APP_URL || 'https://cardpop.com.au');
  add('https://cardpop.com.au');
  add('https://www.cardpop.com.au');
  (process.env.CORS_ORIGIN || '').split(',').forEach(add);
  (process.env.CHECKOUT_RETURN_ORIGINS || '').split(',').forEach(add);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return origins;
}

/** True when `url` is an http(s) URL on one of the app's own origins. */
export function isAppReturnUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (parsed.username || parsed.password) return false;
  if (process.env.NODE_ENV !== 'production' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
    return true;
  }
  return allowedReturnOrigins().has(parsed.origin);
}

/**
 * Validate every supplied return URL. Returns null when all are acceptable,
 * otherwise an error message naming the first offending field.
 */
export function invalidReturnUrl(urls) {
  for (const [field, value] of Object.entries(urls)) {
    if (value == null || value === '') continue;
    if (!isAppReturnUrl(value)) return `${field} must be a cardpop.com.au URL`;
  }
  return null;
}

export default isAppReturnUrl;
