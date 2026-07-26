import { isValidUrl } from './safeFetch.js';

// Shape and value validation for AI-extracted event data.
//
// Shared by the admin scraper route (src/routes/event-scraper.js) and the
// nightly scanner (src/utils/eventScanner.js) so a draft created by the cron is
// held to exactly the same rules as one an admin pastes in by hand. Everything
// here treats its input as untrusted model output: unknown enum values, bad
// date formats and non-URL strings are dropped rather than passed through to
// the database.

export const VALID_EVENT_TYPES = ['card_show', 'trade_event', 'lgs_event', 'community_event'];
export const VALID_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

export function parseAndValidateEventJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('AI response is not a valid string');
  }

  let trimmed = jsonString.trim();
  if (trimmed.startsWith('```json')) trimmed = trimmed.substring(7);
  else if (trimmed.startsWith('```')) trimmed = trimmed.substring(3);
  if (trimmed.endsWith('```')) trimmed = trimmed.substring(0, trimmed.length - 3);
  trimmed = trimmed.trim();

  let eventData;
  try {
    eventData = JSON.parse(trimmed);
  } catch (parseError) {
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
  }

  if (!eventData.title || typeof eventData.title !== 'string' || !eventData.title.trim()) {
    throw new Error('Event data must have a title field');
  }

  return eventData;
}

export function validateAndNormalizeEventData(eventData) {
  if (!eventData.title || typeof eventData.title !== 'string' || !eventData.title.trim()) {
    throw new Error('Event title is required');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  const startDate = typeof eventData.start_date === 'string' && dateRegex.test(eventData.start_date)
    ? eventData.start_date : null;
  const endDate = typeof eventData.end_date === 'string' && dateRegex.test(eventData.end_date)
    ? eventData.end_date : null;
  const startTime = typeof eventData.start_time === 'string' && timeRegex.test(eventData.start_time)
    ? eventData.start_time : null;
  const endTime = typeof eventData.end_time === 'string' && timeRegex.test(eventData.end_time)
    ? eventData.end_time : null;

  const entryFee = (eventData.entry_fee_aud !== null && eventData.entry_fee_aud !== undefined)
    ? (isNaN(Number(eventData.entry_fee_aud)) ? null : Number(eventData.entry_fee_aud))
    : null;

  const presaleFee = (eventData.presale_fee_aud !== null && eventData.presale_fee_aud !== undefined)
    ? (isNaN(Number(eventData.presale_fee_aud)) ? null : Number(eventData.presale_fee_aud))
    : null;

  const capacity = (eventData.capacity !== null && eventData.capacity !== undefined)
    ? (isNaN(parseInt(eventData.capacity, 10)) ? null : parseInt(eventData.capacity, 10))
    : null;

  const imageUrl = eventData.image_url && isValidUrl(eventData.image_url) ? eventData.image_url : null;
  const websiteUrl = eventData.website_url && isValidUrl(eventData.website_url) ? eventData.website_url : null;
  const ticketUrl = eventData.ticket_url && isValidUrl(eventData.ticket_url) ? eventData.ticket_url : null;

  const eventType = VALID_EVENT_TYPES.includes(eventData.event_type) ? eventData.event_type : null;
  const state = VALID_STATES.includes(eventData.state) ? eventData.state : null;

  const featuredCardGames = Array.isArray(eventData.featured_card_games) && eventData.featured_card_games.length > 0
    ? eventData.featured_card_games.filter(g => typeof g === 'string' && g.trim())
    : null;

  const seoKeywords = Array.isArray(eventData.seo_keywords) && eventData.seo_keywords.length > 0
    ? eventData.seo_keywords.filter(k => typeof k === 'string' && k.trim())
    : null;

  const tags = Array.isArray(eventData.tags) && eventData.tags.length > 0
    ? eventData.tags.filter(t => typeof t === 'string' && t.trim())
    : null;

  return {
    title: eventData.title.trim(),
    short_description: eventData.short_description || null,
    description: eventData.description || null,
    event_type: eventType,
    featured_card_games: featuredCardGames,
    venue_name: eventData.venue_name || null,
    address: eventData.address || null,
    suburb: eventData.suburb || null,
    state,
    postcode: eventData.postcode || null,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    organizer_name: eventData.organizer_name || null,
    organizer_email: eventData.organizer_email || null,
    organizer_phone: eventData.organizer_phone || null,
    website_url: websiteUrl,
    ticket_url: ticketUrl,
    entry_fee_aud: entryFee,
    presale_fee_aud: presaleFee,
    is_free: typeof eventData.is_free === 'boolean' ? eventData.is_free : (entryFee === 0 || entryFee === null),
    capacity,
    registration_required: typeof eventData.registration_required === 'boolean' ? eventData.registration_required : false,
    accessibility_info: typeof eventData.accessibility_info === 'string' && eventData.accessibility_info.trim() ? eventData.accessibility_info.trim() : null,
    age_restrictions: typeof eventData.age_restrictions === 'string' && eventData.age_restrictions.trim() ? eventData.age_restrictions.trim() : null,
    image_url: imageUrl,
    seo_title: eventData.seo_title || null,
    seo_description: eventData.seo_description || null,
    seo_keywords: seoKeywords,
    tags,
    source_url: eventData.source_url || null,
  };
}

/** URL-safe slug, matching the frontend's lib/slugify.js output. */
export function slugifyTitle(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Aggressive normalisation used only for "is this the same event?" comparisons.
 * Strips punctuation, collapses whitespace and drops the year, so "Sydney Card
 * Show 2026" and "Sydney Card Show" compare equal when they fall on the same
 * date.
 */
export function comparableTitle(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
