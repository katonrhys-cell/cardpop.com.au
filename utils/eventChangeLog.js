// Organiser edits to live events (docs/event-submissions.md).
//
// An organiser edits their own event directly. Once it's approved their save
// goes live straight away, and the database records every field that changed
// in public.event_change_log as { field: { from, to } } — which bells every
// admin, is emailed to them (POST /events/:id/notify-changes) and is shown in
// Admin → Event Management. This module labels and reads those entries; it is
// shared by the admin dialog, the email and the tests.

import { ticketPriceLines } from './eventTicketPrices.js';

// The event columns that are logged. Must match public.event_logged_fields()
// as last defined in supabase/migrations/ (a test keeps the two equal).
export const EVENT_LOGGED_FIELDS = [
  'title', 'short_description', 'description', 'accessibility_info', 'age_restrictions',
  'event_type', 'featured_card_games', 'image_url', 'gallery_images', 'gallery_albums', 'event_videos',
  'side_events', 'event_prizes', 'prize_pool',
  'venue_name', 'address', 'suburb', 'state', 'postcode',
  'start_date', 'end_date', 'start_time', 'end_time',
  'organizer_name', 'organizer_logo_url', 'organizer_email', 'organizer_phone',
  'website_url', 'ticket_url', 'vendor_application_url', 'tickets_sold_out', 'waitlist_url', 'booking_fee_aud',
  'instagram_url', 'facebook_url', 'youtube_url', 'youtube_channel_url', 'tiktok_url', 'x_url', 'discord_url',
  'facebook_video_url',
  'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'capacity', 'registration_required',
  'seo_title', 'seo_description', 'seo_keywords', 'tags', 'source_url',
];

// The member ticket offer's fields, as log_organiser_offer_edit() names them.
export const OFFER_LOGGED_FIELDS = ['offer_text', 'discount_code', 'referral_url', 'offer_is_active'];

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
  side_events: 'Side events',
  event_prizes: 'Prizes',
  prize_pool: 'Total prize pool',
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
  tickets_sold_out: 'Tickets sold out',
  waitlist_url: 'Waitlist URL',
  booking_fee_aud: 'Booking fee',
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
  source_url: 'Scraped from',
  offer_text: 'Member offer line',
  discount_code: 'Member ticket code',
  referral_url: 'Ticket referral link',
  offer_is_active: 'Member offer switched on',
};

export const changeLabel = (field) => EVENT_CHANGE_LABELS[field] || field;

const TIME_FIELDS = new Set(['start_time', 'end_time']);
const NUMBER_FIELDS = new Set(['entry_fee_aud', 'presale_fee_aud', 'booking_fee_aud', 'capacity']);

// One canonical shape per value: '' / [] / {} / undefined → null,
// "10:00:00" → "10:00", "12.50" → 12.5.
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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A short, human reading of a field's value. */
export function describeEventValue(field, value) {
  const v = normaliseEventValue(field, value);
  if (v === null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (field === 'entry_fee_aud' || field === 'presale_fee_aud' || field === 'booking_fee_aud') {
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
  if (field === 'side_events' && Array.isArray(v)) {
    return v.map((x) => x?.title).filter(Boolean).join('\n') || plural(v.length, 'side event');
  }
  if (field === 'event_prizes' && Array.isArray(v)) {
    return v.map((x) => [x?.place, x?.reward].filter(Boolean).join(': ')).filter(Boolean).join('\n') || plural(v.length, 'prize');
  }
  if (field === 'ticket_prices' && Array.isArray(v)) {
    return ticketPriceLines(v).map((t) => `${t.label}: ${t.price}${t.soldOut ? ' (sold out)' : ''}`).join('\n') || '—';
  }
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Whether a field holds an image URL worth previewing. */
export const isImageChangeField = (field) => field === 'image_url' || field === 'organizer_logo_url';

/**
 * Several log entries (oldest first or newest first — order is taken from
 * created_at) merged into one { field: { from, to } }: each field's first
 * "from" and last "to". A field that ends where it started is dropped.
 */
export function mergeChangeLog(entries) {
  const sorted = [...(entries || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const merged = {};
  for (const entry of sorted) {
    for (const [field, change] of Object.entries(entry?.changes || {})) {
      if (!merged[field]) merged[field] = { from: change?.from ?? null, to: change?.to ?? null };
      else merged[field].to = change?.to ?? null;
    }
  }
  for (const [field, change] of Object.entries(merged)) {
    const same = JSON.stringify(normaliseEventValue(field, change.from)) === JSON.stringify(normaliseEventValue(field, change.to));
    if (same) delete merged[field];
  }
  return merged;
}

/** [{ field, label, from, to }] for display, in form order. */
export function changeRows(changes) {
  const order = [...EVENT_LOGGED_FIELDS, ...OFFER_LOGGED_FIELDS];
  return Object.entries(changes || {})
    .sort(([a], [b]) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    })
    .map(([field, change]) => ({ field, label: changeLabel(field), from: change?.from ?? null, to: change?.to ?? null }));
}
