// "Next edition" of a finished event — the next upcoming show in the same
// series, so a past event page hands its search traffic on instead of
// dead-ending at "This event has ended".
//
// Card shows recur (Hobby Hangout XL Brisbane → Sydney → Melbourne, Perth
// Card Fest 6 → 7, monthly Big Boyz shows), and every edition gets its own
// dated URL. Collectors keep searching the show's name, so Google keeps
// sending them to last edition's page — the one with the history and the
// links. Pointing that page at the next date is what turns the click into
// a ticket, and the link passes the old page's authority to the new one.
//
// Shared by the SPA (pages/EventDetailPage.jsx) and the bot prerender
// (api/prerender.js) so humans and crawlers see the same link.
// Dependency-free apart from the organiser-name helpers.

import { organiserKey, namesOrganiser } from './eventOrganisers.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const DATE_WORDS_RE = new RegExp(`\\b(?:${MONTHS})\\b`, 'g');

/**
 * The series a title belongs to: the title with its year, month, day and
 * edition numbers removed ("Perth Card Fest 7 — November 2026" → "perth card
 * fest"). Two editions in the same city share a stem; editions in different
 * cities don't, and are matched by organiser instead.
 */
export function seriesStem(title) {
  return String(title ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, ' ')
    .replace(DATE_WORDS_RE, ' ')
    .replace(/#?\b\d+(?:st|nd|rd|th)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const orgCore = (name) => organiserKey(name).replace(/^the /, '');

/**
 * True when the two organiser names are the same organiser: equal, or the
 * longer one starts with the shorter ("Supanova" / "Supanova Pop Culture
 * Industries"). Only a leading match counts — "Card Fest" (Melbourne) is not
 * "Perth Card Fest".
 */
export function sameOrganiser(a, b) {
  const ka = orgCore(a);
  const kb = orgCore(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [short, long] = ka.length < kb.length ? [ka, kb] : [kb, ka];
  return long.startsWith(short) && namesOrganiser(long, short);
}

/** True when `candidate` is another edition of `event`'s series. */
export function isSameSeries(event, candidate) {
  if (!event || !candidate) return false;
  if (sameOrganiser(event.organizer_name, candidate.organizer_name)) return true;
  const stem = seriesStem(event.title);
  // A stem of one word ("expo", "con") is too generic to call a series.
  return stem.includes(' ') && stem === seriesStem(candidate.title);
}

const isoDay = (raw) => (typeof raw === 'string' && ISO_DATE_RE.test(raw) ? raw.slice(0, 10) : null);

/**
 * The next upcoming edition of `event` among `candidates`, or null.
 *
 * A candidate qualifies when it is a different, approved event of the same
 * series that starts on or after `today` (the viewer's local `YYYY-MM-DD`)
 * and after `event` finished. Among those, one in the same state wins (a
 * Brisbane collector wants the Gold Coast show before the Perth one), then
 * the earliest start.
 */
export function pickNextEdition(event, candidates, today) {
  if (!event || !Array.isArray(candidates) || !ISO_DATE_RE.test(today || '')) return null;
  const ended = isoDay(event.end_date) || isoDay(event.start_date) || '';
  const sameState = (c) => Boolean(event.state) && c.state === event.state;

  const editions = candidates.filter((c) => {
    if (!c || c.id === event.id || (c.status && c.status !== 'approved')) return false;
    const start = isoDay(c.start_date);
    return Boolean(start) && start >= today && start > ended && isSameSeries(event, c);
  });
  if (!editions.length) return null;

  editions.sort((a, b) => (Number(sameState(b)) - Number(sameState(a)))
    || isoDay(a.start_date).localeCompare(isoDay(b.start_date)));
  return editions[0];
}

/** Columns the next-edition lookup reads — kept small; it only renders a link. */
export const NEXT_EDITION_COLUMNS = 'id, slug, title, status, organizer_name, start_date, end_date, venue_name, suburb, state, image_url';

/** How many upcoming events the lookup scans (the whole upcoming calendar is far smaller). */
export const NEXT_EDITION_SCAN_LIMIT = 150;
