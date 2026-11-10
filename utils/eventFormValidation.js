// Checks and messages for the event form (components/EventFormModal.jsx),
// kept pure so they're unit-tested on their own (tests/frontend/eventFormValidation.test.js).
//
// Why this exists: organisers were tripping over the browser's built-in
// validation — a link typed as "instagram.com/myshow" (no https://) blocked the
// whole Submit with a bubble on whichever tab the field sat on, a HEIC photo
// failed deep inside the upload with "mime type not supported", and a database
// refusal surfaced as "new row violates row-level security policy". The form
// now validates itself, tells the organiser which tab and field to fix, and
// turns those errors into plain English.

// Image types the `events` storage bucket accepts (storage.buckets.allowed_mime_types).
export const EVENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const EVENT_IMAGE_ACCEPT = EVENT_IMAGE_TYPES.join(',');
export const EVENT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** Why a picked cover/gallery photo can't be used, or null when it's fine. */
export function eventImageFileError(file) {
  if (!file) return 'No file was selected.';
  const type = String(file.type || '').toLowerCase();
  if (/hei[cf]/.test(type) || /\.(heic|heif)$/i.test(file.name || '')) {
    return 'iPhone HEIC photos can’t be uploaded yet — please save it as a JPG or PNG and try again.';
  }
  if (!EVENT_IMAGE_TYPES.includes(type)) return 'Please choose a JPG, PNG, WebP or GIF image.';
  if (file.size > EVENT_IMAGE_MAX_BYTES) return 'That image is over 20MB — please choose a smaller one.';
  return null;
}

/** The link fields on the Organiser tab, with the label each error names. */
export const EVENT_URL_FIELDS = {
  website_url: 'Event Website',
  ticket_url: 'Tickets / Registration URL',
  vendor_application_url: 'Trader / Vendor Applications URL',
  instagram_url: 'Instagram URL',
  facebook_url: 'Facebook URL',
  youtube_channel_url: 'YouTube Channel URL',
  tiktok_url: 'TikTok URL',
  x_url: 'X (Twitter) URL',
  discord_url: 'Discord URL',
  facebook_video_url: 'Facebook Public Post / Reel URL',
};

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LOOKS_LIKE_HOST = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[:/?#]|$)/i;

/**
 * A link as people type it → a full https:// URL. "instagram.com/show" and
 * "www.show.com.au" gain https://; "//host" gains https:. Anything else is
 * returned trimmed for isValidHttpUrl to judge.
 */
export function normalizeEventUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (v.startsWith('//')) return `https:${v}`;
  if (!HAS_SCHEME.test(v) && LOOKS_LIKE_HOST.test(v)) return `https://${v}`;
  return v;
}

export function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The first problem with the form, as { field, tab, message } (field = the
 * input's id, so the form can switch tab and focus it), or null when it can
 * be saved. URLs are judged after normalizeEventUrl.
 */
export function validateEventForm(form) {
  const fail = (field, tab, message) => ({ field, tab, message });
  if (!String(form.title || '').trim()) return fail('title', 'details', 'Please give your event a title.');
  if (!form.start_date) return fail('start_date', 'venue', 'Please add the date your event starts.');
  if (form.end_date && form.end_date < form.start_date) {
    return fail('end_date', 'venue', 'The end date is before the start date.');
  }
  const sameDay = !form.end_date || form.end_date === form.start_date;
  if (sameDay && form.start_time && form.end_time && form.end_time <= form.start_time) {
    return fail('end_time', 'venue', 'The end time is before the start time. For an event that runs past midnight, set an end date.');
  }
  const postcode = String(form.postcode || '').trim();
  if (postcode && !/^\d{4}$/.test(postcode)) return fail('postcode', 'venue', 'An Australian postcode is 4 digits.');

  const email = String(form.organizer_email || '').trim();
  if (email && !EMAIL.test(email)) return fail('organizer_email', 'organiser', 'That contact email doesn’t look right.');
  for (const [field, label] of Object.entries(EVENT_URL_FIELDS)) {
    const url = normalizeEventUrl(form[field]);
    if (url && !isValidHttpUrl(url)) {
      return fail(field, 'organiser', `${label} isn’t a valid web address — paste the full link, e.g. https://example.com`);
    }
  }
  if (!form.is_free) {
    for (const [field, label] of [['entry_fee_aud', 'Entry fee'], ['presale_fee_aud', 'Presale price']]) {
      const raw = String(form[field] ?? '').trim();
      if (raw && !(Number(raw) >= 0)) return fail(field, 'organiser', `${label} must be a price of $0 or more.`);
    }
  }
  const capacity = String(form.capacity ?? '').trim();
  if (capacity && !(Number.isInteger(Number(capacity)) && Number(capacity) > 0)) {
    return fail('capacity', 'organiser', 'Max capacity must be a whole number above 0 (or leave it blank).');
  }
  return null;
}

/** A save / upload error → a sentence an organiser can act on. */
export function describeEventSaveError(err) {
  const msg = String(err?.message || err?.error || '').trim();
  const code = String(err?.code || err?.statusCode || '');
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'We couldn’t save this event — it may have been changed by the CardPop team since you opened it. Refresh My Events and try again.';
  }
  if (/mime type|not supported/i.test(msg)) return 'One of your images is a file type we can’t store. Please use JPG, PNG, WebP or GIF.';
  if (/exceeded the maximum allowed size|payload too large|413/i.test(msg) || code === '413') {
    return 'One of your images is too large. Please use files under 20MB.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'You seem to be offline — check your connection and try again. Nothing was lost; your form is still filled in.';
  }
  if (/jwt|not authenticated|auth session missing/i.test(msg)) {
    return 'Your sign-in has expired. Sign in again in another tab, then save — your form is still filled in.';
  }
  return msg || 'Failed to save event';
}
