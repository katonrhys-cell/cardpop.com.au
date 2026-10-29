// Event organiser logo — the organiser's brand mark shown on the event page
// beside the title, above Event Details (`events.organizer_logo_url`). It can
// be a still image or a "moving" one: an animated GIF / animated WebP, or a
// short muted MP4 / WebM loop. Dependency-free so the form, the page,
// lib/eventSeo.js and api/prerender.js agree on what a logo is.

export const LOGO_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const LOGO_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const LOGO_ACCEPT = [...LOGO_IMAGE_TYPES, ...LOGO_VIDEO_TYPES].join(',');

// A logo renders at ~300 px wide; a short loop needs nowhere near the bucket's
// 20 MB ceiling, and every event-page visitor downloads it.
export const LOGO_MAX_BYTES = 8 * 1024 * 1024;
export const LOGO_MAX_LABEL = '8 MB';

const VIDEO_EXT_RE = /\.(mp4|webm)(\?|#|$)/i;

/** Why a picked file can't be the logo, or null when it can. */
export function logoFileError(file) {
  if (!file) return 'Choose a file.';
  const type = String(file.type || '').toLowerCase();
  if (!LOGO_IMAGE_TYPES.includes(type) && !LOGO_VIDEO_TYPES.includes(type)) {
    return 'Use a PNG, JPG, WebP or GIF image, or a short MP4 / WebM loop.';
  }
  if (file.size > LOGO_MAX_BYTES) return `That file is too big — keep the logo under ${LOGO_MAX_LABEL}.`;
  return null;
}

/** True when the file is a video loop (rendered with <video>, not <img>). */
export function isVideoLogoFile(file) {
  return LOGO_VIDEO_TYPES.includes(String(file?.type || '').toLowerCase());
}

/** True when a stored logo URL points at a video loop. */
export function isVideoLogoUrl(url) {
  return typeof url === 'string' && VIDEO_EXT_RE.test(url);
}

/** The stored logo URL if it is a plain http(s) link, else null. */
export function safeLogoUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Alt text for the logo: the organiser's name when known, else the event's. */
export function logoAltText(event) {
  const who = event?.organizer_name || event?.name || event?.title || 'Event organiser';
  return `${who} logo`;
}
