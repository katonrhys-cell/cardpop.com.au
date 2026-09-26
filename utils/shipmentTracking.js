// Shipment tracking helpers shared by the admin UI, the buyer's order list and
// the backend "mark as shipped" endpoint + email. Dependency-free on purpose so
// both the SPA and the Express side import the same carrier list and links.

// Australia Post's tracker also resolves StarTrack consignments, so StarTrack
// links go there too.
const AUSPOST_TRACK = 'https://auspost.com.au/mypost/track/details/';

export const CARRIERS = {
  auspost:   { label: 'Australia Post', trackUrl: AUSPOST_TRACK },
  startrack: { label: 'StarTrack',      trackUrl: AUSPOST_TRACK },
  sendle:    { label: 'Sendle',         trackUrl: 'https://track.sendle.com/tracking?ref=' },
  aramex:    { label: 'Aramex',         trackUrl: 'https://www.aramex.com.au/tools/track?l=' },
  other:     { label: 'Other courier',  trackUrl: null },
};

export const CARRIER_IDS = Object.keys(CARRIERS);
export const DEFAULT_CARRIER = 'auspost';

// Tracking references are letters, digits and the odd dash. People paste them
// with spaces ("33AB 1234 5678") — strip those and upper-case.
const TRACKING_RE = /^[A-Z0-9-]{4,40}$/;

export function normalizeTrackingNumber(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

export function isValidTrackingNumber(value) {
  return TRACKING_RE.test(normalizeTrackingNumber(value));
}

export function carrierLabel(carrier) {
  return CARRIERS[carrier]?.label || CARRIERS.other.label;
}

/** Public tracking page for a consignment, or null when the carrier has none. */
export function trackingUrl(carrier, trackingNumber) {
  const base = CARRIERS[carrier]?.trackUrl;
  const number = normalizeTrackingNumber(trackingNumber);
  if (!base || !number) return null;
  return base + encodeURIComponent(number);
}
