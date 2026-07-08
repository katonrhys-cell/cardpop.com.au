// Amazon Location Service (Places API v2) — address autocomplete + lookup for
// the checkout shipping form. The public API key is injected at build time by
// Vite.
//
// Amazon Location's standalone Places endpoint accepts an API key as a `?key=`
// query param (no AWS SDK / SigV4 signing needed), so the browser can call it
// directly with a plain `fetch` — the same shape the old Google Places layer
// used, but rendered through our own suggestion dropdown instead of a Google
// widget.
//
// When the key is absent the autocomplete layer is DISABLED: the shipping form
// falls back to plain free-text inputs and the "select a real address" gate is
// not enforced client-side. The server-side geocode check
// (src/utils/addressValidation.js) is the authoritative guarantee either way,
// so the client can safely fail-open on a missing key or a network error.

export const AMAZON_LOCATION_API_KEY = import.meta.env.VITE_AWS_LOCATION_API_KEY || '';
export const AMAZON_LOCATION_REGION = import.meta.env.VITE_AWS_LOCATION_REGION || 'ap-southeast-2';
export const AMAZON_LOCATION_ENABLED = Boolean(AMAZON_LOCATION_API_KEY);

const AU_STATES = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);

function endpoint(path) {
  return (
    `https://places.geo.${AMAZON_LOCATION_REGION}.amazonaws.com${path}` +
    `${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(AMAZON_LOCATION_API_KEY)}`
  );
}

/**
 * Fetch address suggestions for a partial query, restricted to Australia.
 * Returns a list of `{ placeId, label }` — the caller renders `label` in the
 * dropdown and passes `placeId` back to {@link getPlaceDetails} on selection.
 *
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<Array<{ placeId: string, label: string }>>}
 */
export async function autocompleteAddress(query, { signal } = {}) {
  if (!AMAZON_LOCATION_ENABLED) return [];
  const text = (query || '').trim();
  if (text.length < 3) return [];

  const res = await fetch(endpoint('/v2/autocomplete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      QueryText: text,
      Filter: { IncludeCountries: ['AUS'] },
      MaxResults: 6,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`autocomplete failed: ${res.status}`);

  const data = await res.json().catch(() => ({}));
  const items = Array.isArray(data?.ResultItems) ? data.ResultItems : [];
  return items
    .filter(item => item?.PlaceId && item?.Title)
    .map(item => ({ placeId: item.PlaceId, label: item.Title }));
}

/**
 * Look up the full structured address for a `placeId` returned by
 * {@link autocompleteAddress}, and map it into CardPop's shipping shape.
 * Returns `null` when the place is not a real, in-Australia street address (so
 * the caller can reject it rather than accept a vague result).
 *
 * @param {string} placeId
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ address, suburb, state, postcode, placeId, formatted, verified } | null>}
 */
export async function getPlaceDetails(placeId, { signal } = {}) {
  if (!AMAZON_LOCATION_ENABLED || !placeId) return null;

  const res = await fetch(endpoint(`/v2/place/${encodeURIComponent(placeId)}`), {
    method: 'GET',
    signal,
  });
  if (!res.ok) throw new Error(`get-place failed: ${res.status}`);

  const data = await res.json().catch(() => ({}));
  return parsePlace({ ...data, PlaceId: data?.PlaceId || placeId });
}

/**
 * Convert an Amazon Location place (from GetPlace) into CardPop's structured
 * shipping shape. Returns `null` when it is not a real, in-Australia street
 * address.
 */
export function parsePlace(place) {
  const addr = place?.Address;
  if (!addr) return null;

  // AU addresses only — reject anything resolved outside Australia.
  const country = addr.Country?.Code2 || addr.Country?.Code3 || '';
  if (country && country !== 'AU' && country !== 'AUS') return null;

  const address = [addr.AddressNumber, addr.Street].filter(Boolean).join(' ').trim();
  // The deliverable suburb is `Locality`; fall back to the district variants
  // Amazon Location occasionally uses.
  const suburb = addr.Locality || addr.District || addr.SubDistrict || '';
  // Region.Code is the state abbreviation; strip a leading ISO "AU-" if present.
  const state = (addr.Region?.Code || '').replace(/^AU-/i, '').toUpperCase();
  const postcode = addr.PostalCode || '';

  // A real shipping destination needs a street and a suburb, and a state we
  // recognise — a bare suburb or postcode selection is not deliverable.
  if (!addr.Street || !suburb || !AU_STATES.has(state)) return null;

  return {
    address,
    suburb,
    state,
    postcode,
    placeId: place.PlaceId || '',
    formatted: addr.Label || '',
    verified: true,
  };
}
