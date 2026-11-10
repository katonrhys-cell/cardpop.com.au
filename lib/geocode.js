// Coordinates for the Local Map's stores and events.
//
// The browser used to geocode every address against OpenStreetMap's Nominatim
// itself, one per second, on every visit. Now it builds the address strings,
// sends them in one request to POST /geocode/batch, and the server answers
// from a shared cache (src/utils/geocodeCache.js), looking each address up
// once. Anything without an answer yet falls back to its state's centroid.

import apiServerClient from '@/lib/apiServerClient.js';

/**
 * The most precise query the fields allow, or null when only a state (or
 * nothing) is known — those are placed on the state centroid without a lookup.
 * Priority: street address → venue name → suburb → postcode.
 */
export function buildGeocodeQuery({ address, venueName, suburb, state, postcode } = {}) {
  if (address && suburb && state) return `${address}, ${suburb}, ${state}`;
  if (address && postcode) return `${address}, ${postcode}`;
  if (venueName && suburb && state) return `${venueName}, ${suburb}, ${state}`;
  if (venueName && postcode) return `${venueName}, ${postcode}`;
  if (suburb && state) return `${suburb}, ${state}`;
  if (postcode) return String(postcode);
  return null;
}

// Must match normaliseQueryKey() in src/utils/geocodeCache.js.
const keyOf = (q) => String(q || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);

/**
 * Coordinates for each params object, in order: [lat, lng], or the state
 * centroid when the address has no answer yet (or the request failed), or null.
 */
export async function geocodeBatch(paramsList) {
  const queries = paramsList.map(buildGeocodeQuery);
  let results = {};
  const wanted = [...new Set(queries.filter(Boolean))];
  if (wanted.length) {
    try {
      const res = await apiServerClient.fetch('/geocode/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: wanted }),
      });
      if (res.ok) results = (await res.json())?.results || {};
    } catch { /* fall back to state centroids */ }
  }
  return paramsList.map((params, i) => {
    const hit = queries[i] ? results[keyOf(queries[i])] : null;
    if (Array.isArray(hit) && hit.length === 2) return hit;
    return STATE_CENTROIDS[String(params?.state || '').toUpperCase()] || null;
  });
}

// Approximate state centroids as instant fallback when no address data exists
export const STATE_CENTROIDS = {
  NSW: [-33.8688, 151.2093],
  VIC: [-37.8136, 144.9631],
  QLD: [-27.4698, 153.0251],
  WA:  [-31.9505, 115.8605],
  SA:  [-34.9285, 138.6007],
  TAS: [-42.8821, 147.3272],
  ACT: [-35.2809, 149.1300],
  NT:  [-12.4634, 130.8456],
};
