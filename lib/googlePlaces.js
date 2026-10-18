// Google Places API (New) — address autocomplete + lookup for the checkout
// shipping form. The public, browser-restricted API key is injected at build
// time by Vite (`VITE_GOOGLE_PLACES_API_KEY`).
//
// This talks to the REST endpoints (`places.googleapis.com/v1`) with a plain
// `fetch` rather than loading the Maps JavaScript SDK: the suggestion dropdown
// is CardPop's own (components/checkout/ShippingAddressForm.jsx), so nothing
// needs Google's widget, and a script-free integration keeps the strict CSP
// (`strict-dynamic` + Trusted Types) untouched. The key needs **Places API
// (New)** enabled in Google Cloud and should be restricted to the site's HTTP
// referrers — see docs/address-autocomplete.md.
//
// Shape-compatible with lib/amazonLocation.js: `autocompleteAddress()` returns
// `{ placeId, label, place }` suggestions and `resolveSuggestion()` turns a pick
// into CardPop's `{ address, suburb, state, postcode, placeId, formatted,
// verified }`. lib/addressAutocomplete.js picks whichever provider has a key.
//
// When the key is absent the layer is DISABLED and the form falls back to plain
// free-text inputs. The server-side check (src/utils/addressValidation.js) is
// the authoritative guarantee either way, so the client fails open.

export const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';
export const GOOGLE_PLACES_ENABLED = Boolean(GOOGLE_PLACES_API_KEY);

const BASE_URL = 'https://places.googleapis.com/v1';
const AU_STATES = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
// Only the fields the shipping form needs — Places (New) bills by field mask.
const DETAILS_FIELD_MASK = 'id,formattedAddress,addressComponents';

// Autocomplete + the Place Details call that follows a pick are billed as one
// "session" when they share a token; a new token starts after each pick.
let sessionToken = null;
function currentSessionToken() {
  if (!sessionToken) sessionToken = newSessionToken();
  return sessionToken;
}
function newSessionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Turn a non-2xx response into an Error carrying the status and Google's own
// message (e.g. "API key not valid" / "Places API (New) has not been used in
// project …"), so a misconfigured key is distinguishable from a network blip.
async function errorFromResponse(op, res) {
  let detail = '';
  try {
    const body = await res.text();
    try { detail = JSON.parse(body)?.error?.message || body; } catch { detail = body; }
  } catch { /* body unreadable */ }
  const err = new Error(`Google Places ${op} failed: ${res.status}${detail ? ` — ${detail}` : ''}`);
  err.status = res.status;
  return err;
}

/**
 * Fetch address suggestions for a partial query, restricted to Australia.
 *
 * Returns `{ placeId, label, place }` items; `place` is the raw prediction.
 * Unlike Amazon Location, Google's autocomplete response carries no structured
 * address, so {@link resolveSuggestion} always makes one Place Details call.
 * Throws on an HTTP / network error so the caller can log the real cause and
 * degrade to manual entry.
 *
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<Array<{ placeId: string, label: string, place: object }>>}
 */
export async function autocompleteAddress(query, { signal } = {}) {
  if (!GOOGLE_PLACES_ENABLED) return [];
  const text = (query || '').trim();
  if (text.length < 3) return [];

  const res = await fetch(`${BASE_URL}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
    },
    body: JSON.stringify({
      input: text,
      includedRegionCodes: ['au'],
      // Addresses only — no businesses, suburbs or landmarks in the list.
      includedPrimaryTypes: ['street_address', 'subpremise', 'premise'],
      languageCode: 'en-AU',
      sessionToken: currentSessionToken(),
    }),
    signal,
  });
  if (!res.ok) throw await errorFromResponse('autocomplete', res);

  const data = await res.json().catch(() => ({}));
  const items = Array.isArray(data?.suggestions) ? data.suggestions : [];
  return items
    .map(s => s?.placePrediction)
    .filter(p => p?.placeId && p?.text?.text)
    .map(p => ({ placeId: p.placeId, label: p.text.text, place: p }));
}

/**
 * Resolve a chosen suggestion into CardPop's structured shipping shape via a
 * Place Details lookup (closing the billing session).
 *
 * @param {{ placeId: string }} suggestion
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ address, suburb, state, postcode, placeId, formatted, verified } | null>}
 */
export async function resolveSuggestion(suggestion, { signal } = {}) {
  if (!suggestion?.placeId) return null;
  return getPlaceDetails(suggestion.placeId, { signal });
}

/**
 * Look up the full structured address for a `placeId`. Returns `null` when the
 * place is not a real, in-Australia street address. Throws on an HTTP /
 * network error.
 *
 * @param {string} placeId
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function getPlaceDetails(placeId, { signal } = {}) {
  if (!GOOGLE_PLACES_ENABLED || !placeId) return null;

  const token = currentSessionToken();
  // A details call ends the session whether or not it succeeds.
  sessionToken = null;

  const url = `${BASE_URL}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
    signal,
  });
  if (!res.ok) throw await errorFromResponse('place-details', res);

  const data = await res.json().catch(() => ({}));
  return parsePlace({ ...data, id: data?.id || placeId });
}

function component(components, type, field = 'longText') {
  const match = components.find(c => Array.isArray(c?.types) && c.types.includes(type));
  return (match?.[field] || '').trim();
}

/**
 * Convert a Google Place (Place Details, `addressComponents` field) into
 * CardPop's structured shipping shape. Returns `null` when it is not a real,
 * in-Australia street address.
 */
export function parsePlace(place) {
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  if (components.length === 0) return null;

  // AU addresses only — reject anything resolved outside Australia.
  const country = component(components, 'country', 'shortText').toUpperCase();
  if (country && country !== 'AU') return null;

  const streetNumber = component(components, 'street_number');
  const street = component(components, 'route');
  const unit = component(components, 'subpremise');
  // The deliverable suburb is `locality`; Google occasionally only gives the
  // postal town or a sublocality for an address.
  const suburb =
    component(components, 'locality') ||
    component(components, 'postal_town') ||
    component(components, 'sublocality_level_1') ||
    component(components, 'sublocality');
  const state = component(components, 'administrative_area_level_1', 'shortText').toUpperCase();
  const postcode = component(components, 'postal_code');

  // A real shipping destination needs a street and a suburb, and a state we
  // recognise — a bare suburb or postcode selection is not deliverable.
  if (!street || !suburb || !AU_STATES.has(state)) return null;

  const streetLine = [streetNumber, street].filter(Boolean).join(' ').trim();
  // A unit/apartment prefix ("4/12 Smith St") keeps the whole address on one
  // line, the way Australia Post reads it.
  const address = unit ? `${unit}/${streetLine}` : streetLine;

  return {
    address,
    suburb,
    state,
    postcode,
    placeId: place.id || '',
    formatted: place.formattedAddress || '',
    verified: true,
  };
}
