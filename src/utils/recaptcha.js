import logger from './logger.js';

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

let warnedMissingSecret = false;

/**
 * Verify a Google reCAPTCHA v2 token against the siteverify endpoint.
 *
 * Fails OPEN when RECAPTCHA_SECRET_KEY is not configured — the check is
 * simply skipped so the app keeps working in dev / before the key is set in
 * Vercel. Once the secret is present, verification is enforced (fails closed).
 *
 * @param {string} token   The `g-recaptcha-response` token from the browser.
 * @param {string} [remoteip] Optional end-user IP (req.ip) for extra signal.
 * @returns {Promise<{ success: boolean, skipped?: boolean, errorCodes?: string[], hostname?: string }>}
 */
export async function verifyRecaptchaToken(token, remoteip) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    if (!warnedMissingSecret) {
      logger.warn('[recaptcha] RECAPTCHA_SECRET_KEY is not set — skipping verification (fail-open).');
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
    logger.error('[recaptcha] siteverify request failed:', err);
    // Network failure talking to Google — fail closed so we don't wave bots
    // through on an outage, but surface a clear error to the caller.
    return { success: false, errorCodes: ['verify-request-failed'] };
  }
}

export default verifyRecaptchaToken;
