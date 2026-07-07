import logger from './logger.js';

// Google Address Validation API — the authoritative "is this a real, deliverable
// address" check. Runs server-side before a checkout session is created so a
// client that bypasses the Places autocomplete widget still can't push a fake
// address through.
//
// Fails OPEN when no key is configured (dev / before the key is set in Vercel):
// the check is skipped so checkout keeps working. Once the key is present the
// check is enforced (a request that can't be verified fails closed).
const ENDPOINT = 'https://addressvalidation.googleapis.com/v1:validateAddress';

// Granularities Google returns that we treat as a real, deliverable address.
// PREMISE / SUB_PREMISE = a specific building or unit; PREMISE_PROXIMITY covers
// rural / newly-built addresses geocoded near (but not exactly at) the premise.
const DELIVERABLE_GRANULARITY = new Set(['PREMISE', 'SUB_PREMISE', 'PREMISE_PROXIMITY']);

let warnedMissingKey = false;

function serverKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ADDRESS_VALIDATION_KEY || '';
}

/**
 * Validate an Australian shipping address against Google's Address Validation
 * API.
 *
 * @param {{ address?: string, address2?: string, suburb?: string, state?: string, postcode?: string }} addr
 * @returns {Promise<{ valid: boolean, skipped?: boolean, reason?: string, granularity?: string, formatted?: string }>}
 */
export async function validateShippingAddress(addr = {}) {
  const key = serverKey();
  if (!key) {
    if (!warnedMissingKey) {
      logger.warn('[address] GOOGLE_MAPS_API_KEY not set — skipping address validation (fail-open).');
      warnedMissingKey = true;
    }
    return { valid: true, skipped: true };
  }

  const { address, address2, suburb, state, postcode } = addr;
  if (!address || !suburb || !state || !postcode) {
    return { valid: false, reason: 'incomplete' };
  }

  // Line 1 = street (+ unit if given); line 2 = suburb / state / postcode.
  const line1 = address2 ? `${address2}, ${address}` : address;
  const addressLines = [line1, `${suburb} ${state} ${postcode}`];

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: { regionCode: 'AU', addressLines },
      }),
    });

    if (!res.ok) {
      logger.error(`[address] validation request failed: ${res.status}`);
      // Google reachable but errored — fail closed so we don't wave fake
      // addresses through, but the error is distinguishable from "invalid".
      return { valid: false, reason: 'request-failed' };
    }

    const data = await res.json().catch(() => ({}));
    const verdict = data?.result?.verdict || {};
    const granularity = verdict.validationGranularity || 'OTHER';
    const formatted = data?.result?.address?.formattedAddress;

    const valid = DELIVERABLE_GRANULARITY.has(granularity);
    return { valid, granularity, formatted, reason: valid ? undefined : 'not-deliverable' };
  } catch (err) {
    logger.error('[address] validation request threw:', err);
    return { valid: false, reason: 'request-failed' };
  }
}

export default validateShippingAddress;
