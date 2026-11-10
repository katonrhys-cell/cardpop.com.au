// Featured events — the paid "Featured placement" on /list-your-event.
//
// An admin switches `events.is_featured` on in the event form. The public
// calendar shows the badge only while the event is live and upcoming: an
// ended, archived, pending or cancelled event never wears it, so a featuring
// lapses on its own once the show is over. Dependency-free (no React, no
// Supabase) so the SPA, the prerender and tests share one rule.

import { isPastEvent } from './eventPast.js';

export const FEATURED_STRIP_LIMIT = 6;

/** `today` is the viewer's local `YYYY-MM-DD` (toLocalDateStr). */
export const isFeaturedEvent = (event, today) =>
  Boolean(event?.is_featured) && event.status === 'approved' && !isPastEvent(event, today);

/**
 * Featured events first, everything else after, each group keeping its
 * existing order (the calendar's date order). Returns a new array.
 */
export const featuredFirst = (events, today) => {
  const list = Array.isArray(events) ? events : [];
  const featured = [];
  const rest = [];
  for (const ev of list) (isFeaturedEvent(ev, today) ? featured : rest).push(ev);
  return featured.concat(rest);
};

/** The calendar's "Featured events" strip: soonest first, capped. */
export const featuredStrip = (events, today, limit = FEATURED_STRIP_LIMIT) =>
  (Array.isArray(events) ? events : [])
    .filter((ev) => isFeaturedEvent(ev, today))
    .sort((a, b) => String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')))
    .slice(0, limit);
