import logger from './logger.js';

// Amazon Location Service (Places API v2) — the authoritative "is this a real,
// deliverable address" check. Runs server-side before a checkout session is
// created so a client that bypasses the address autocomplete widget still can't
// push a fake address through.
//
// Fails OPEN when no key is configured (dev / before the key is set in Vercel):
// the check is skipped so checkout keeps working. Once the key is present the
// check is enforced (a request that can't be verified fails closed).
//
// Auth: Amazon Location API keys are passed as a `?key=` query param on the
// standalone Places endpoint (`places.geo.<region>.amazonaws.com`) — no AWS
// SigV4 signing or SDK required, mirroring the old Google key-based call.

// Place types Amazon Location returns that we treat as a real, deliverable
// address. `PointAddress` is a specific building (≈ Google PREMISE);
// `InterpolatedAddress` is interpolated along the street for rural / newly-built
// addresses geocoded near (but not exactly at) the premise (≈ PREMISE_PROXIMITY).
const DELIVERABLE_PLACE_TYPES = new Set(['PointAddress', 'InterpolatedAddress']);

// Minimum overall match confidence (0–1) Amazon Location must report before we
// accept the geocode. Below this the address is treated as unverifiable.
const MIN_MATCH_SCORE = 0.8;

const DEFAULT_REGION = 'ap-southeast-2'; // Sydney

let warnedMissingKey = false;

function serverKey() {
  return process.env.AWS_LOCATION_API_KEY || process.env.AWS_LOCATION_PLACES_KEY || '';
}

function region() {
  return process.env.AWS_LOCATION_REGION || DEFAULT_REGION;
}

/**
 * Validate an Australian shipping address against Amazon Location Service's
 * Places API (geocode).
 *
 * @param {{ address?: string, address2?: string, suburb?: string, state?: string, postcode?: string }} addr
 * @returns {Promise<{ valid: boolean, skipped?: boolean, reason?: string, granularity?: string, formatted?: string }>}
 */
export async function validateShippingAddress(addr = {}) {
  const key = serverKey();
  if (!key) {
    if (!warnedMissingKey) {
      logger.warn('[address] AWS_LOCATION_API_KEY not set — skipping address validation (fail-open).');
      warnedMissingKey = true;
    }
    return { valid: true, skipped: true };
  }

  const { address, address2, suburb, state, postcode } = addr;
  if (!address || !suburb || !state || !postcode) {
    return { valid: false, reason: 'incomplete' };
  }

  // Full single-line query: street (+ unit if given), then suburb / state / postcode.
  const line1 = address2 ? `${address2}, ${address}` : address;
  const queryText = `${line1}, ${suburb} ${state} ${postcode}`;

  const endpoint =
    `https://places.geo.${region()}.amazonaws.com/v2/geocode` +
    `?key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        QueryText: queryText,
        Filter: { IncludeCountries: ['AUS'] },
        MaxResults: 1,
      }),
    });

    if (!res.ok) {
      logger.error(`[address] validation request failed: ${res.status}`);
      // AWS reachable but errored — fail closed so we don't wave fake addresses
      // through, but the error is distinguishable from "invalid".
      return { valid: false, reason: 'request-failed' };
    }

    const data = await res.json().catch(() => ({}));
    const result = data?.ResultItems?.[0] || {};
    const placeType = result.PlaceType || 'OTHER';
    const score = result.MatchScores?.Overall ?? 0;
    const formatted = result.Address?.Label;

    const valid = DELIVERABLE_PLACE_TYPES.has(placeType) && score >= MIN_MATCH_SCORE;
    return { valid, granularity: placeType, formatted, reason: valid ? undefined : 'not-deliverable' };
  } catch (err) {
    logger.error('[address] validation request threw:', err);
    return { valid: false, reason: 'request-failed' };
  }
}

export default validateShippingAddress;
