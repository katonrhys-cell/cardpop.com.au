// Shared helpers for rendering Supabase event records and building
// schema.org structured data for SEO.

export const SITE_URL = 'https://cardpop.online';

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

  if (event.description || event.short_description) {
    jsonLd.description = event.short_description || event.description;
  }
  if (event.image_url) jsonLd.image = [event.image_url];

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

  if (event.organizer_name) {
    const sameAs = [event.instagram_url, event.facebook_url].filter(Boolean);
    jsonLd.organizer = {
      '@type': 'Organization',
      name: event.organizer_name,
      ...(event.website_url ? { url: event.website_url } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    };
  }

  if (event.is_free || event.entry_fee_aud != null) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: event.is_free ? 0 : Number(event.entry_fee_aud) || undefined,
      priceCurrency: 'AUD',
      availability: 'https://schema.org/InStock',
      url: event.ticket_url || event.website_url || eventUrl(event),
    };
    if (jsonLd.offers.price === undefined) delete jsonLd.offers.price;
  }

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
