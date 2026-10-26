// Pure helpers for the searchable event picker (components/events/EventPicker.jsx).

// Columns the picker needs — never select('*') for a search result.
export const EVENT_PICKER_COLUMNS = 'id, title, slug, start_date, end_date, venue_name, suburb, state, status';

// The term is interpolated into a PostgREST `or=(…)` filter, where commas,
// parentheses and wildcards are syntax. Strip them rather than escape them:
// nobody searches for an event by punctuation.
export const sanitizeEventQuery = (raw) =>
  String(raw ?? '')
    .replace(/[,()*%\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

// `start_date` is a plain date — parse it as local midnight so an AEST
// browser doesn't render the day before.
const parseDay = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatEventDates = (event) => {
  const start = parseDay(event?.start_date);
  if (!start) return '';
  const end = parseDay(event?.end_date);
  const fmt = (d, opts) => d.toLocaleDateString('en-AU', opts);
  if (!end || end.getTime() === start.getTime()) {
    return fmt(start, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (end.getFullYear() === start.getFullYear() && end.getMonth() === start.getMonth()) {
    return `${start.getDate()}–${fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

export const formatEventPlace = (event) =>
  [event?.venue_name, [event?.suburb, event?.state].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

export const eventSubtitle = (event) =>
  [formatEventDates(event), formatEventPlace(event)].filter(Boolean).join(' · ');

export const eventPath = (event) => `/events/${event?.slug || event?.id}`;

// The default (empty-search) list starts a month back so a show that just
// finished can still be discussed.
export const recentWindowStart = (today = new Date()) => {
  const d = new Date(today);
  d.setDate(d.getDate() - 30);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
