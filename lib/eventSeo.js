// Shared helpers for rendering Supabase event records and building
// schema.org structured data for SEO.

export const SITE_URL = 'https://cardpop.com.au';

export const EVENT_TYPE_LABELS = {
  card_show: 'Card Show',
  trade_event: 'Trade Event',
  community_event: 'Community Event',
  lgs_event: 'Store Event',
};

export const eventTypeLabel = (event) =>
  EVENT_TYPE_LABELS[event?.event_type] || event?.type || 'Event';

export const eventPath = (event) => `/events/${event.slug || event.id}`;

export const eventUrl = (event) => `${SITE_URL}${eventPath(event)}`;

const AU_DATE = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
const AU_DATE_LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
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
  if (event.entry_fee_aud != null && Number(event.entry_fee_aud) > 0) {
    return `$${Number(event.entry_fee_aud).toFixed(2)} AUD`;
  }
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

// schema.org VideoObject for an event's YouTube video — makes the page
// eligible for video rich results. Returns null when the event has no
// parseable youtube_url. Google requires uploadDate; the closest truthful
// value we hold is when the listing was last updated (i.e. when the video
// link was added).
export const buildVideoJsonLd = (event) => {
  const id = youTubeVideoId(event?.youtube_url);
  if (!id) return null;
  const name = event.title || event.name || 'Trading Card Event';
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${name} — Event Video`,
    description: event.short_description || event.description
      || `Video for ${name}, a trading card event listed on CardPop Australia.`,
    thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    uploadDate: event.updated_at || event.created_at || event.start_date,
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
};

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
  jsonLd.image = [event.image_url || `${SITE_URL}/og-image.jpg`];

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
  const sameAs = [event.instagram_url, event.facebook_url].filter(Boolean);
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
  // validFrom so the listing is eligible for the events rich result.
  jsonLd.offers = {
    '@type': 'Offer',
    price: event.is_free ? 0 : Number(event.entry_fee_aud) || 0,
    priceCurrency: 'AUD',
    availability: 'https://schema.org/InStock',
    url: event.ticket_url || event.website_url || eventUrl(event),
    validFrom: event.created_at || jsonLd.startDate,
  };

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
