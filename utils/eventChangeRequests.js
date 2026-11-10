// Organiser change requests on live events (docs/event-submissions.md).
//
// An organiser can't edit a live event directly. Their edit becomes an
// event_change_requests row holding only the fields that differ; an admin
// applies it (apply_event_change_request) or dismisses it. Shared by the form,
// the admin review dialog and the tests.

import { ticketPriceLines } from './eventTicketPrices.js';
import { cleanGalleryAlbums, flattenGalleryAlbums } from './eventGallery.js';
import { cleanEventVideos } from './eventVideos.js';

// The only columns an organiser can ask to change. Must match
// public.event_change_request_fields() in
// supabase/migrations/20261109235618_event_organiser_review_flow.sql (a test
// keeps the two equal).
export const EVENT_CHANGE_FIELDS = [
  'title', 'short_description', 'description', 'accessibility_info', 'age_restrictions',
  'event_type', 'featured_card_games', 'image_url', 'gallery_images', 'gallery_albums', 'event_videos',
  'venue_name', 'address', 'suburb', 'state', 'postcode',
  'start_date', 'end_date', 'start_time', 'end_time',
  'organizer_name', 'organizer_logo_url', 'organizer_email', 'organizer_phone',
  'website_url', 'ticket_url', 'vendor_application_url',
  'instagram_url', 'facebook_url', 'youtube_url', 'youtube_channel_url', 'tiktok_url', 'x_url', 'discord_url',
  'facebook_video_url',
  'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'capacity', 'registration_required',
  'seo_title', 'seo_description', 'seo_keywords', 'tags',
];

export const EVENT_CHANGE_LABELS = {
  title: 'Title',
  short_description: 'Short description',
  description: 'Full description',
  accessibility_info: 'Accessibility',
  age_restrictions: 'Age restrictions',
  event_type: 'Event type',
  featured_card_games: 'Featured card games',
  image_url: 'Cover image',
  gallery_images: 'Gallery photos',
  gallery_albums: 'Photo albums',
  event_videos: 'Videos',
  venue_name: 'Venue',
  address: 'Street address',
  suburb: 'Suburb',
  state: 'State',
  postcode: 'Postcode',
  start_date: 'Start date',
  end_date: 'End date',
  start_time: 'Start time',
  end_time: 'End time',
  organizer_name: 'Organiser name',
  organizer_logo_url: 'Organiser logo',
  organizer_email: 'Contact email',
  organizer_phone: 'Contact phone',
  website_url: 'Event website',
  ticket_url: 'Tickets URL',
  vendor_application_url: 'Trader applications URL',
  instagram_url: 'Instagram',
  facebook_url: 'Facebook',
  youtube_url: 'First video',
  youtube_channel_url: 'YouTube channel',
  tiktok_url: 'TikTok',
  x_url: 'X (Twitter)',
  discord_url: 'Discord',
  facebook_video_url: 'Facebook post / reel',
  entry_fee_aud: 'Entry fee',
  presale_fee_aud: 'Presale fee',
  ticket_prices: 'Ticket prices',
  is_free: 'Free entry',
  capacity: 'Max capacity',
  registration_required: 'Registration required',
  seo_title: 'SEO title',
  seo_description: 'Meta description',
  seo_keywords: 'SEO keywords',
  tags: 'Tags',
};

const TIME_FIELDS = new Set(['start_time', 'end_time']);
const NUMBER_FIELDS = new Set(['entry_fee_aud', 'presale_fee_aud', 'capacity']);

// One canonical shape per value so a field the organiser didn't touch never
// counts as a change: '' / [] / {} / undefined → null, "10:00:00" → "10:00",
// "12.50" → 12.5.
export function normaliseEventValue(field, value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    if (TIME_FIELDS.has(field)) return s.slice(0, 5);
    if (NUMBER_FIELDS.has(field)) return Number.isFinite(Number(s)) ? Number(s) : s;
    return s;
  }
  if (Array.isArray(value)) return value.length ? value : null;
  if (typeof value === 'object') return Object.keys(value).length ? value : null;
  return value;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The live row as the form would save it untouched. The form rebuilds photo
// albums and the video list from the legacy columns (gallery_images,
// youtube_url) and saves a free event's fee as 0, so the row is read the same
// way — otherwise a field nobody touched would show up as a change.
function asFormWouldSave(event) {
  const albums = cleanGalleryAlbums(event?.gallery_albums, event?.gallery_images)
    .filter((a) => a.images.length > 0);
  const videos = cleanEventVideos(event?.event_videos, event?.youtube_url).map((v) => ({ title: v.title, url: v.url }));
  return {
    ...event,
    gallery_albums: albums,
    gallery_images: flattenGalleryAlbums(albums),
    event_videos: videos,
    youtube_url: videos[0]?.url || null,
    entry_fee_aud: event?.is_free !== false && event?.entry_fee_aud == null ? 0 : event?.entry_fee_aud,
  };
}

/**
 * The requestable fields of `payload` (the form's save payload) that differ
 * from the live `event` row. Returns the payload's own values.
 */
export function diffEventChanges(event, payload) {
  const changes = {};
  const live = asFormWouldSave(event);
  for (const field of EVENT_CHANGE_FIELDS) {
    if (!payload || !(field in payload)) continue;
    const before = normaliseEventValue(field, live[field]);
    const after = normaliseEventValue(field, payload[field]);
    if (!same(before, after)) changes[field] = payload[field] ?? null;
  }
  return changes;
}

/** The live event with an open request's changes laid over it (to prefill the form). */
export function withRequestedChanges(event, changeRequest) {
  if (!event || !changeRequest?.changes) return event;
  return { ...event, ...changeRequest.changes };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A short, human reading of a field's value for the admin review dialog. */
export function describeEventValue(field, value) {
  const v = normaliseEventValue(field, value);
  if (v === null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (field === 'entry_fee_aud' || field === 'presale_fee_aud') {
    return Number.isFinite(Number(v)) ? `$${Number(v).toFixed(2)}` : String(v);
  }
  if (field === 'gallery_albums' && Array.isArray(v)) {
    const photos = v.reduce((n, a) => n + (Array.isArray(a?.images) ? a.images.length : 0), 0);
    return `${plural(v.length, 'album')}, ${plural(photos, 'photo')}`;
  }
  if (field === 'gallery_images' && Array.isArray(v)) return plural(v.length, 'photo');
  if (field === 'event_videos' && Array.isArray(v)) {
    return v.map((x) => x?.title || x?.url).filter(Boolean).join('\n') || plural(v.length, 'video');
  }
  if (field === 'ticket_prices' && Array.isArray(v)) {
    return ticketPriceLines(v).map((t) => `${t.label}: ${t.price}`).join('\n') || '—';
  }
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Whether a field holds an image URL the review dialog should preview. */
export const isImageChangeField = (field) => field === 'image_url' || field === 'organizer_logo_url';
