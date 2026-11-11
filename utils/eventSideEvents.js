// Side events (events.side_events). A card show is rarely one tournament —
// "The Calling: Sydney" is a Friday of side events, a Saturday main event and
// a Sunday showdown. An organiser lists each one so collectors can plan their
// weekend. Dependency-free so the event form, the event page, lib/eventSeo.js
// and api/prerender.js all read the same shape.
//
// Stored shape: [{ title, date, start_time, end_time, entry_fee_aud,
// player_cap, description, url }] — list order is what the form shows; the
// page sorts by day and start time (sortSideEvents) so the schedule always
// reads chronologically.

export const MAX_SIDE_EVENTS = 40;
export const MAX_SIDE_EVENT_TITLE_CHARS = 80;
export const MAX_SIDE_EVENT_DESCRIPTION_CHARS = 300;

const trimOrEmpty = (v) => (typeof v === 'string' ? v.trim() : '');

export const emptySideEvent = () => ({
  title: '', date: '', start_time: '', end_time: '', entry_fee_aud: '', player_cap: '', description: '', url: '',
});

const isoDate = (v) => {
  const m = trimOrEmpty(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // Reject 2026-02-31 and friends: the round trip must give the same day.
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
    ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

// 'HH:MM' (seconds, as Postgres time columns return them, are dropped).
const hhmm = (v) => {
  const m = trimOrEmpty(v).match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};

// http(s) only — a stored "javascript:" link must never become an href.
export const safeHttpUrl = (v) => {
  const s = trimOrEmpty(v);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
};

const money = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
};

const wholeNumber = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : null;
};

/**
 * Normalise whatever the DB (or the form) holds into display side events:
 * entries without a title are dropped, an impossible date / time / link is
 * blanked rather than shown, text is trimmed and capped. `entry_fee_aud` is a
 * number (0 = free) or null (not stated); `player_cap` a positive integer or
 * null. Returns [{ title, date, start_time, end_time, entry_fee_aud,
 * player_cap, description, url }] in stored order.
 */
export const cleanSideEvents = (list) => (Array.isArray(list) ? list : [])
  .map((s) => ({
    title: trimOrEmpty(s?.title).slice(0, MAX_SIDE_EVENT_TITLE_CHARS),
    date: isoDate(s?.date),
    start_time: hhmm(s?.start_time),
    end_time: hhmm(s?.end_time),
    entry_fee_aud: money(s?.entry_fee_aud),
    player_cap: wholeNumber(s?.player_cap),
    description: trimOrEmpty(s?.description).slice(0, MAX_SIDE_EVENT_DESCRIPTION_CHARS),
    url: safeHttpUrl(s?.url),
  }))
  .filter((s) => s.title)
  .slice(0, MAX_SIDE_EVENTS);

/** Chronological: by day (undated last), then start time (untimed last), stable. */
export const sortSideEvents = (events) => events
  .map((e, i) => [e, i])
  .sort(([a, ai], [b, bi]) => (
    (a.date || '9999').localeCompare(b.date || '9999')
    || (a.start_time || '99:99').localeCompare(b.start_time || '99:99')
    || ai - bi
  ))
  .map(([e]) => e);

/** [{ date, events }] — one group per day, in date order; undated ones share a trailing group with date ''. */
export const groupSideEventsByDay = (events) => {
  const groups = [];
  for (const e of sortSideEvents(events)) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.events.push(e);
    else groups.push({ date: e.date, events: [e] });
  }
  return groups;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Friday 13 November" — computed in UTC so the viewer's timezone can't shift the day. */
export const formatSideEventDay = (date) => {
  const iso = isoDate(date);
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
};

const clock = (hhmmValue) => {
  const [h, m] = hhmmValue.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "9:00 AM", "9:00 AM – 5:00 PM", or '' when no time is set (an end time alone is ignored). */
export const formatSideEventTime = (sideEvent) => {
  if (!sideEvent?.start_time) return '';
  return sideEvent.end_time ? `${clock(sideEvent.start_time)} – ${clock(sideEvent.end_time)}` : clock(sideEvent.start_time);
};

/** "Free", "$120.00", or '' when no fee was stated. */
export const formatSideEventFee = (sideEvent) => {
  const fee = sideEvent?.entry_fee_aud;
  if (fee === null || fee === undefined) return '';
  return fee === 0 ? 'Free' : `$${fee.toFixed(2)}`;
};

/**
 * Form-side check, run before saving (rows as the editor holds them, strings
 * throughout): a row with anything filled in needs a name, and a typed link
 * must be a usable http(s) address. Returns a message or null.
 */
export const sideEventsFormError = (rows) => {
  for (const [i, r] of (Array.isArray(rows) ? rows : []).entries()) {
    const filled = ['date', 'start_time', 'end_time', 'entry_fee_aud', 'player_cap', 'description', 'url']
      .some((k) => String(r?.[k] ?? '').trim());
    const title = trimOrEmpty(r?.title);
    if (!title && filled) return `Side event ${i + 1} needs a name — or remove it.`;
    if (trimOrEmpty(r?.url) && !safeHttpUrl(r.url)) return `"${title}": the registration link must be a full web address (https://…).`;
    if (r?.entry_fee_aud !== '' && r?.entry_fee_aud != null && money(r.entry_fee_aud) === null) return `"${title}": entry fee must be a number, or 0 for free.`;
  }
  return null;
};

/** Stored side events → the string rows the editor edits. */
export const sideEventsToForm = (list) => cleanSideEvents(list).map((s) => ({
  ...s,
  entry_fee_aud: s.entry_fee_aud === null ? '' : String(s.entry_fee_aud),
  player_cap: s.player_cap === null ? '' : String(s.player_cap),
}));

/**
 * schema.org `subEvent` entries for the Event JSON-LD — one per side event
 * that has a day (an Event needs a startDate), in schedule order. `location`
 * is the parent event's Place, reused so each subEvent says where it is.
 * Times are Australian eastern, like the parent's (+10:00).
 */
export const buildSubEventLds = (sideEvents, { location } = {}) => sortSideEvents(cleanSideEvents(sideEvents))
  .filter((s) => s.date)
  .map((s) => ({
    '@type': 'Event',
    name: s.title,
    startDate: s.start_time ? `${s.date}T${s.start_time}:00+10:00` : s.date,
    ...(s.end_time ? { endDate: `${s.date}T${s.end_time}:00+10:00` } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    ...(s.description ? { description: s.description } : {}),
    ...(s.url ? { url: s.url } : {}),
    ...(location ? { location } : {}),
    ...(s.entry_fee_aud !== null
      ? { offers: { '@type': 'Offer', price: s.entry_fee_aud, priceCurrency: 'AUD', ...(s.url ? { url: s.url } : {}) } }
      : {}),
  }));
