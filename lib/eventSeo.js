// Shared helpers for rendering Supabase event records and building
// schema.org structured data for SEO.

import { Ticket, Handshake, Users, Store } from 'lucide-react';
import { cleanTicketPrices, ticketPriceOfferName } from '@/utils/eventTicketPrices.js';
import { cleanEventVideos, youTubeWatchUrl, youTubeEmbedUrl as youTubeEmbedUrlForId, youTubeThumbnailUrl as youTubeThumbnailUrlForId } from '@/utils/eventVideos.js';
import { cleanGalleryAlbums, flattenGalleryAlbums } from '@/utils/eventGallery.js';

export const SITE_URL = 'https://cardpop.com.au';
// Gallery photos appended to Event JSON-LD `image` after the cover.
export const MAX_JSON_LD_GALLERY_IMAGES = 8;

export const EVENT_TYPE_LABELS = {
  card_show: 'Card Show',
  trade_event: 'Trade Event',
  community_event: 'Community Event',
  lgs_event: 'Store Event',
};

export const eventTypeLabel = (event) =>
  EVENT_TYPE_LABELS[event?.event_type] || event?.type || 'Event';

// Single source of truth for the color/icon each event category renders
// with — keep every pill (event cards, detail pages, profile listings) in
// sync by pulling from this map instead of re-deriving colors locally.
export const EVENT_TYPE_STYLES = {
  card_show:       { gradient: 'from-red-500 to-rose-600',       Icon: Ticket    },
  trade_event:     { gradient: 'from-blue-500 to-indigo-600',    Icon: Handshake },
  community_event: { gradient: 'from-violet-500 to-purple-600',  Icon: Users     },
  lgs_event:       { gradient: 'from-amber-500 to-orange-500',   Icon: Store     },
};

export const eventTypeStyle = (event) => EVENT_TYPE_STYLES[event?.event_type] || null;

export const eventPath = (event) => `/events/${event.slug || event.id}`;

export const eventUrl = (event) => `${SITE_URL}${eventPath(event)}`;

const AU_DATE = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
const AU_DATE_LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

// Parse an event's date-only string ("YYYY-MM-DD") as LOCAL midnight. Bare
// `new Date("2026-08-01")` is UTC midnight, so month/day grouping done on it can
// land a day (and thus month) off from the local date shown on the card. Always
// parse event date-only strings through this.
export const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Local-time YYYY-MM-DD for a Date. new Date().toISOString() is UTC, so for
// Australian users (UTC+10/11) it returns *yesterday* between local midnight
// and ~10-11am — which pushes finished events into "today"/"upcoming" date
// filters. Build the string from local date parts instead. Events store
// date-only strings, so all "upcoming"/"today" comparisons must use this.
export const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatEventDate = (event, long = false) => {
  const opts = long ? AU_DATE_LONG : AU_DATE;
  const start = parseDate(event.start_date);
  if (!start) return event.date || 'Date TBA';
  const end = parseDate(event.end_date);
  if (end && event.end_date !== event.start_date) {
    return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', opts)}`;
  }
  return start.toLocaleDateString('en-AU', opts);
};

const formatTime = (time) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, '0')}${suffix}` : `${hour12}${suffix}`;
};

export const formatEventTime = (event) => {
  const start = formatTime(event.start_time);
  const end = formatTime(event.end_time);
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  return event.time || 'Times TBA — check with organiser';
};

export const formatEventLocation = (event) => {
  const parts = [event.venue_name, event.suburb, event.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return event.location || 'Venue TBA';
};

export const formatEntryFee = (event) => {
  if (event.is_free) return 'Free entry';
  const ga = Number(event.entry_fee_aud) > 0 ? Number(event.entry_fee_aud) : null;
  const presale = Number(event.presale_fee_aud) > 0 ? Number(event.presale_fee_aud) : null;
  if (ga && presale) return `$${ga.toFixed(2)} AUD (presale/early bird $${presale.toFixed(2)})`;
  if (ga) return `$${ga.toFixed(2)} AUD`;
  if (presale) return `Presale/early bird $${presale.toFixed(2)} AUD`;
  return 'See organiser for ticket pricing';
};

// Extract the 11-character YouTube video id from any common URL shape:
// watch?v=, youtu.be/, shorts/, live/, embed/ (plain ids are not accepted —
// admins paste full URLs).
export const youTubeVideoId = (url) => {
  if (!url) return null;
  const match = String(url).match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
};

export const youTubeEmbedUrl = (url) => {
  const id = youTubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
};

export const youTubeThumbnailUrl = (url) => {
  const id = youTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
};

// Facebook public post / Reel embeds — https://developers.facebook.com/docs/plugins
// Returns the facebook.com/plugins iframe URL for a public Facebook URL, or
// null for anything that isn't a facebook.com / fb.watch link (so an arbitrary
// URL stored on an event can never become an iframe src). Video-style URLs
// (videos, Reels, watch, fb.watch, /share/v|r/) use the video player plugin;
// any other public post URL falls back to the post plugin.
export const facebookEmbedUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (!/^((www|m|web)\.)?facebook\.com$/.test(parsed.hostname) && parsed.hostname !== 'fb.watch') return null;
  const isVideo = parsed.hostname === 'fb.watch'
    || /\/(videos?|reels?|watch)(\/|$)/.test(parsed.pathname)
    || /\/share\/[vr]\//.test(parsed.pathname);
  return isVideo
    ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
    : `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}`;
};

// schema.org VideoObject for each of an event's YouTube videos
// (utils/eventVideos.js; events.youtube_url alone still counts as one) —
// makes the page eligible for video rich results. Returns [] when the event
// has no parseable video. Google requires uploadDate; the closest truthful
// value we hold is when the listing was last updated (i.e. when the video
// link was added).
export const buildVideoJsonLds = (event) => {
  const videos = cleanEventVideos(event?.event_videos, event?.youtube_url);
  if (videos.length === 0) return [];
  const name = event.title || event.name || 'Trading Card Event';
  const description = event.short_description || event.description
    || `Video for ${name}, a trading card event listed on CardPop Australia.`;
  return videos.map((video, i) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title ? `${name} — ${video.title}` : `${name} — Event Video${videos.length > 1 ? ` ${i + 1}` : ''}`,
    description,
    thumbnailUrl: [youTubeThumbnailUrlForId(video.id)],
    uploadDate: event.updated_at || event.created_at || event.start_date,
    contentUrl: youTubeWatchUrl(video.id),
    embedUrl: youTubeEmbedUrlForId(video.id),
  }));
};

// The first video's VideoObject, or null — kept for readers that expect one.
export const buildVideoJsonLd = (event) => buildVideoJsonLds(event)[0] || null;

// schema.org Event — https://developers.google.com/search/docs/appearance/structured-data/event
export const buildEventJsonLd = (event) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title || event.name,
    startDate: event.start_time
      ? `${event.start_date}T${event.start_time}+10:00`
      : event.start_date,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: eventUrl(event),
  };

  const endDate = event.end_date || event.start_date;
  if (endDate) {
    jsonLd.endDate = event.end_time ? `${endDate}T${event.end_time}+10:00` : endDate;
  }

  // Google's event rich-result report flags every missing recommended field
  // (description, image, offers, organizer, …), so always emit them with
  // site-level fallbacks when the record has no data of its own.
  jsonLd.description = event.short_description || event.description
    || `${jsonLd.name} at ${formatEventLocation(event)} on ${formatEventDate(event)} — a trading card event listed on CardPop Australia.`;
  // Google shows the first few images in event rich results, so the gallery
  // (cover first) goes in too — capped so a 24-photo album doesn't bloat the
  // document head.
  jsonLd.image = [
    event.image_url || `${SITE_URL}/og-image.jpg`,
    ...flattenGalleryAlbums(cleanGalleryAlbums(event.gallery_albums, event.gallery_images)).slice(0, MAX_JSON_LD_GALLERY_IMAGES),
  ];

  if (event.age_restrictions) jsonLd.typicalAgeRange = event.age_restrictions;

  jsonLd.location = {
    '@type': 'Place',
    name: event.venue_name || formatEventLocation(event),
    address: {
      '@type': 'PostalAddress',
      ...(event.address ? { streetAddress: event.address } : {}),
      ...(event.suburb ? { addressLocality: event.suburb } : {}),
      ...(event.state ? { addressRegion: event.state } : {}),
      ...(event.postcode ? { postalCode: event.postcode } : {}),
      addressCountry: 'AU',
    },
  };

  const organizerName = event.organizer_name || 'CardPop';
  // Organiser profiles — the links the Organiser tab collects
  // (migration 20261029020720_event_organiser_links.sql).
  const sameAs = [
    event.instagram_url, event.facebook_url, event.youtube_channel_url,
    event.tiktok_url, event.x_url, event.discord_url,
  ].filter(Boolean);
  jsonLd.organizer = {
    '@type': 'Organization',
    name: organizerName,
    url: event.website_url || eventUrl(event),
    ...(sameAs.length ? { sameAs } : {}),
  };

  // schema.org Event requires a performer. Card shows have no headline act, so
  // the organising entity stands in as the performing group.
  jsonLd.performer = {
    '@type': 'Organization',
    name: organizerName,
  };

  // Always advertise an Offer with a concrete price (0 for free events) plus a
  // validFrom so the listing is eligible for the events rich result. When a
  // separate presale/early-bird price is known it becomes a second Offer — or
  // the only one, when the general-admission price hasn't been published yet.
  const offerBase = {
    '@type': 'Offer',
    priceCurrency: 'AUD',
    availability: 'https://schema.org/InStock',
    url: event.ticket_url || event.website_url || eventUrl(event),
    validFrom: event.created_at || jsonLd.startDate,
  };
  // Child / VIP / early & late access / group prices follow as more Offers.
  const presaleFee = Number(event.presale_fee_aud) > 0 ? Number(event.presale_fee_aud) : null;
  const gaKnown = event.is_free || Number(event.entry_fee_aud) > 0;
  const gaOffer = { ...offerBase, name: 'General admission', price: event.is_free ? 0 : Number(event.entry_fee_aud) || 0 };
  const extraOffers = event.is_free ? [] : cleanTicketPrices(event.ticket_prices)
    .map(row => ({ ...offerBase, name: ticketPriceOfferName(row), price: row.price_aud }));
  const offers = [
    ...(gaKnown || (!presaleFee && !extraOffers.length) ? [gaOffer] : []),
    ...(presaleFee ? [{ ...offerBase, name: 'Presale / early bird', price: presaleFee }] : []),
    ...extraOffers,
  ];
  jsonLd.offers = offers.length === 1 ? offers[0] : offers;

  return jsonLd;
};

export const buildEventListJsonLd = (events) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Trading Card Shows & TCG Events in Australia',
  numberOfItems: events.length,
  itemListElement: events.map((event, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: buildEventJsonLd(event),
  })),
});

export const buildBreadcrumbJsonLd = (event) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Events', item: `${SITE_URL}/events` },
    { '@type': 'ListItem', position: 3, name: event.title || event.name, item: eventUrl(event) },
  ],
});
