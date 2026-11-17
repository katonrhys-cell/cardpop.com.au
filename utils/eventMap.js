// Google Maps links for an event's venue. Dependency-free.

/** Locations that name no real place and so can't be put on a map. */
const NO_PLACE = /^(tba|tbc|tbd|online|virtual|to be (announced|confirmed))\b/i;

/**
 * Embed / open / directions URLs for a free-text venue address, or null when
 * the address is blank or isn't a place ("Online", "TBA").
 */
export function eventMapLinks(location) {
  const address = typeof location === 'string' ? location.trim() : '';
  if (!address || NO_PLACE.test(address)) return null;
  const q = encodeURIComponent(address);
  return {
    embedUrl: `https://www.google.com/maps?q=${q}&z=15&output=embed`,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}
