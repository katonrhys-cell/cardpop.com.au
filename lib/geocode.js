// Geocoding utility using Nominatim (OpenStreetMap) — 1 req/sec rate limit.
// Geocodes the most precise address string available.
// Results cached in memory for the page session.

const cache = new Map();
const queue = [];
let running = false;

async function processQueue() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const { key, query, resolve } = queue.shift();
    if (cache.has(key)) { resolve(cache.get(key)); continue; }
    try {
      const q = encodeURIComponent(query + ', Australia');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=au`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'CardPop.online/1.0' } }
      );
      const data = await res.json();
      const coords = data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
      cache.set(key, coords);
      resolve(coords);
    } catch {
      cache.set(key, null);
      resolve(null);
    }
    // Respect Nominatim rate limit: max 1 req/sec
    await new Promise(r => setTimeout(r, 1100));
  }
  running = false;
}

/**
 * Geocode an address string. Builds the most precise query possible from the
 * provided fields, falling back to broader terms if specifics are missing.
 *
 * Priority: street address → venue name → suburb → state centroid
 */
export function geocodeLocation({ address, venueName, suburb, state, postcode }) {
  // Build query from most to least specific
  let query;
  if (address && suburb && state) {
    query = `${address}, ${suburb}, ${state}`;
  } else if (address && postcode) {
    query = `${address}, ${postcode}`;
  } else if (venueName && suburb && state) {
    query = `${venueName}, ${suburb}, ${state}`;
  } else if (venueName && postcode) {
    query = `${venueName}, ${postcode}`;
  } else if (suburb && state) {
    query = `${suburb}, ${state}`;
  } else if (postcode) {
    query = postcode;
  } else if (state) {
    return Promise.resolve(STATE_CENTROIDS[state?.toUpperCase()] || null);
  } else {
    return Promise.resolve(null);
  }

  const key = query.toLowerCase().trim();
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  return new Promise(resolve => {
    queue.push({ key, query, resolve });
    processQueue();
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
