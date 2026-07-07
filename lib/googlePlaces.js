// Google Places (Maps JS API) loader + address parsing for the checkout
// shipping form. Public API key is injected at build time by Vite.
//
// When the key is absent the Places layer is DISABLED: the shipping form falls
// back to plain free-text inputs and the "select a real address" gate is not
// enforced client-side. The server-side Address Validation check
// (src/utils/addressValidation.js) is the authoritative guarantee either way,
// so the client can safely fail-open on a missing key or a script load error.

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_PLACES_ENABLED = Boolean(GOOGLE_MAPS_API_KEY);

const SCRIPT_ATTR = 'data-google-maps';

let scriptPromise = null;

/**
 * Load the Google Maps JS API (with the Places library) exactly once, shared
 * across every autocomplete field. Resolves with the `window.google` global.
 */
export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Google Maps API key not configured'));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;

  const src =
    'https://maps.googleapis.com/maps/api/js' +
    `?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
    '&libraries=places&loading=async';

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${SCRIPT_ATTR}]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.setAttribute(SCRIPT_ATTR, '');
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      scriptPromise = null; // allow a later retry
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Pull a single component's value out of the Places `address_components` array.
function pick(components, type, useShort = false) {
  const match = components.find(c => c.types.includes(type));
  if (!match) return '';
  return useShort ? match.short_name : match.long_name;
}

/**
 * Convert a Google Places `PlaceResult` into CardPop's structured shipping
 * shape. Returns `null` when the place is not a real, in-Australia street
 * address (so the caller can reject it rather than accept a vague result).
 *
 * @returns {{ address, suburb, state, postcode, placeId, formatted, verified } | null}
 */
export function parsePlace(place) {
  const components = place?.address_components;
  if (!Array.isArray(components) || components.length === 0) return null;

  // AU addresses only — reject anything Google resolved outside Australia.
  const country = pick(components, 'country', true);
  if (country && country !== 'AU') return null;

  const streetNumber = pick(components, 'street_number');
  const route = pick(components, 'route');
  // In AU, the deliverable suburb is `locality`; fall back through the
  // sublocality/postal_town variants Google occasionally uses.
  const suburb =
    pick(components, 'locality') ||
    pick(components, 'postal_town') ||
    pick(components, 'sublocality') ||
    pick(components, 'sublocality_level_1');
  const state = pick(components, 'administrative_area_level_1', true);
  const postcode = pick(components, 'postal_code');

  const address = [streetNumber, route].filter(Boolean).join(' ').trim();

  // A real shipping destination needs at least a street and a suburb — a bare
  // suburb or postcode selection is not deliverable.
  if (!route || !suburb || !state) return null;

  return {
    address,
    suburb,
    state,
    postcode,
    placeId: place.place_id || '',
    formatted: place.formatted_address || '',
    verified: true,
  };
}
