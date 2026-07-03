import apiServerClient from '@/lib/apiServerClient.js';

// Public site key, injected at build time by Vite. When it's absent the whole
// reCAPTCHA layer is disabled (component renders nothing, forms don't require a
// token) so local dev works without keys.
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
export const RECAPTCHA_ENABLED = Boolean(RECAPTCHA_SITE_KEY);

/**
 * Send a reCAPTCHA token to the backend for verification.
 *
 * @param {string} token  The `g-recaptcha-response` token from the widget.
 * @param {object} [extra] Optional extra payload (e.g. `{ newsletter }`).
 * @throws {Error} if verification fails, with a user-friendly message.
 * @returns {Promise<object>} the parsed success response.
 */
export async function verifyRecaptcha(token, extra = {}) {
  const res = await apiServerClient.fetch('/recaptcha/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...extra }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'reCAPTCHA verification failed. Please try again.');
  }

  return res.json().catch(() => ({ success: true }));
}
