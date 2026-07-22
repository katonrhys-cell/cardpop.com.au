import logger from './logger.js';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let warnedMissingSecret = false;

/**
 * Verify a Cloudflare Turnstile token against the siteverify endpoint.
 *
 * Fails OPEN when TURNSTILE_SECRET_KEY is not configured — the check is simply
 * skipped so the app keeps working before the secret is set in Vercel. Once the
 * secret is present, verification is enforced (fails closed).
 *
 * Note: the Turnstile widget used by the Supabase Auth flows verifies its token
 * inside Supabase (secret in the Supabase dashboard). This util is for our own
 * Express endpoints (e.g. the contact form), which must verify the token
 * themselves; set the same Turnstile secret as TURNSTILE_SECRET_KEY in Vercel.
 *
 * @param {string} token   The Turnstile response token from the browser.
 * @param {string} [remoteip] Optional end-user IP (req.ip) for extra signal.
 * @returns {Promise<{ success: boolean, skipped?: boolean, errorCodes?: string[], hostname?: string }>}
 */
export async function verifyTurnstileToken(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (!warnedMissingSecret) {
      logger.warn('[turnstile] TURNSTILE_SECRET_KEY is not set — skipping verification (fail-open).');
      warnedMissingSecret = true;
    }
    return { success: true, skipped: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  const params = new URLSearchParams({ secret, response: token });
  if (remoteip) params.set('remoteip', remoteip);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json().catch(() => ({}));
    return {
      success: Boolean(data.success),
      errorCodes: data['error-codes'],
      hostname: data.hostname,
    };
  } catch (err) {
    logger.error('[turnstile] siteverify request failed:', err);
    // Network failure talking to Cloudflare — fail closed so we don't wave bots
    // through on an outage, but surface a clear error to the caller.
    return { success: false, errorCodes: ['verify-request-failed'] };
  }
}

export default verifyTurnstileToken;
