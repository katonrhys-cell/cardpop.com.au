const KIT_API_BASE = 'https://api.kit.com/v4';

/**
 * Subscribe an email address to the Kit.com (ConvertKit) newsletter form.
 *
 * Returns a plain result object rather than throwing for expected upstream
 * failures (validation, "already subscribed", missing config) so callers can
 * decide how to surface them. Network-level failures propagate as thrown
 * errors for the caller's try/catch.
 *
 * @param {string} email
 * @param {string} [firstName]
 * @param {{ list?: 'launch' }} [options] — list 'launch' targets the pre-launch
 *   notify form (KIT_LAUNCH_FORM_ID), falling back to the main newsletter form
 *   until that env var is configured.
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
export async function subscribeToNewsletter(email, firstName, { list } = {}) {
  const apiKey = process.env.KIT_API_KEY;
  const formId = (list === 'launch' && process.env.KIT_LAUNCH_FORM_ID) || process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    return { ok: false, status: 503, error: 'Newsletter service is not configured.' };
  }

  const response = await fetch(`${KIT_API_BASE}/forms/${formId}/subscribers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email_address: email.trim().toLowerCase(),
      ...(firstName?.trim() && { first_name: firstName.trim() }),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.errors?.[0]?.message || body?.message || 'Subscription failed.';
    return { ok: false, status: response.status, error: message };
  }

  return { ok: true };
}

export default subscribeToNewsletter;
