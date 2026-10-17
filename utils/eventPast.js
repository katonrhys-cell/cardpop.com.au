// Is an event over? One answer for the calendar, the cards, the detail page
// and the attendee-review form. Dependency-free (no React, no Supabase, no
// Date parsing): dates are the ISO `YYYY-MM-DD` strings the DB stores, so a
// plain string comparison is a correct date comparison.
//
// The DB has the same rule in `event_has_ended()` (migration
// 20261017044544_past_events_and_attendee_reviews.sql) — keep them in step.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// Last calendar day of the event, or null when it has no date at all.
export const eventLastDay = (event) => {
  const raw = event?.end_date || event?.start_date;
  if (typeof raw !== 'string') return null;
  const m = raw.match(ISO_DATE_RE);
  return m ? m[0] : null;
};

// `today` is the viewer's local date as `YYYY-MM-DD` (see toLocalDateStr in
// lib/eventSeo.js) — never new Date().toISOString(), which is yesterday for
// Australians until mid-morning.
export const isPastEvent = (event, today) => {
  if (!event) return false;
  if (event.status === 'completed') return true;
  const last = eventLastDay(event);
  if (!last || !ISO_DATE_RE.test(today || '')) return false;
  return last < today;
};

// Only an event that is (or was) public and has finished takes reviews.
export const canReviewEvent = (event, today) =>
  isPastEvent(event, today) && (event.status === 'approved' || event.status === 'completed');

export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;
export const REVIEW_TITLE_MAX = 120;

// Client-side mirror of the table's CHECK constraints, so the form can say
// what is wrong before the round trip. Returns an error message or null.
export const validateAttendeeReview = ({ rating, title, body } = {}) => {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return 'Pick a star rating from 1 to 5.';
  const t = (title || '').trim();
  if (t.length > REVIEW_TITLE_MAX) return `Keep the title under ${REVIEW_TITLE_MAX} characters.`;
  const b = (body || '').trim();
  if (b.length < REVIEW_BODY_MIN) return `Write at least ${REVIEW_BODY_MIN} characters about the event.`;
  if (b.length > REVIEW_BODY_MAX) return `Keep the review under ${REVIEW_BODY_MAX} characters.`;
  return null;
};
