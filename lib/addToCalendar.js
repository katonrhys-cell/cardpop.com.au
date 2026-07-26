// "Add to calendar" links for event detail pages.
//
// Events store a date-only string plus optional wall-clock times ("10:00"),
// and the wall clock belongs to the state the event runs in — not the
// visitor's browser. So every time is resolved against the venue's IANA zone
// and emitted as UTC, which every calendar app reads unambiguously and which
// sidesteps shipping VTIMEZONE blocks in the .ics.

import { eventUrl, formatEventLocation } from '@/lib/eventSeo.js';

const STATE_TIME_ZONES = {
  NSW: 'Australia/Sydney',
  ACT: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  WA: 'Australia/Perth',
  TAS: 'Australia/Hobart',
  NT: 'Australia/Darwin',
};

const DEFAULT_TIME_ZONE = 'Australia/Sydney';

// Minutes an event with a start time but no end time is assumed to run for.
const DEFAULT_DURATION_MINUTES = 120;

export const eventTimeZone = (event) =>
  STATE_TIME_ZONES[String(event?.state || '').trim().toUpperCase()] || DEFAULT_TIME_ZONE;

// How far `timeZone` is ahead of UTC (in minutes) at the given instant.
const zoneOffsetMinutes = (instant, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(instant)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60000;
};

// Turn a wall-clock time in `timeZone` into the matching UTC instant. The
// offset depends on the instant we're solving for, so guess once with the
// offset at the naive UTC reading and correct if a DST boundary moved it.
const zonedWallClockToUtc = (y, mo, d, h, mi, timeZone) => {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const firstGuess = new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60000);
  const settled = zoneOffsetMinutes(firstGuess, timeZone);
  return new Date(naive - settled * 60000);
};

const parseDateParts = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const parseTimeParts = (value) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const h = Number(match[1]);
  const mi = Number(match[2]);
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? [h, mi] : null;
};

const pad = (n) => String(n).padStart(2, '0');

const utcStamp = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
  `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

const dateStamp = ([y, mo, d]) => `${y}${pad(mo)}${pad(d)}`;

const addDays = ([y, mo, d], days) => {
  const shifted = new Date(Date.UTC(y, mo - 1, d + days));
  return [shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()];
};

/**
 * Resolve an event record into the span a calendar entry should cover.
 * Returns `{ allDay, start, end }` — with `[y, m, d]` tuples when all-day and
 * UTC `Date`s when timed — or null when the event has no usable start date.
 *
 * All-day is used when no start time is published, and for multi-day events
 * whose end time is unknown: a guessed clock time on the wrong day is worse
 * than a correct date range.
 */
export const eventCalendarSpan = (event) => {
  const startDate = parseDateParts(event?.start_date);
  if (!startDate) return null;

  const endDate = parseDateParts(event?.end_date) || startDate;
  const startTime = parseTimeParts(event?.start_time);
  const endTime = parseTimeParts(event?.end_time);
  const spansDays = dateStamp(endDate) !== dateStamp(startDate);

  if (!startTime || (spansDays && !endTime)) {
    // DTEND is exclusive for all-day entries, so push it one day past the last day.
    return { allDay: true, start: startDate, end: addDays(endDate, 1) };
  }

  const timeZone = eventTimeZone(event);
  const start = zonedWallClockToUtc(...startDate, ...startTime, timeZone);
  let end = endTime
    ? zonedWallClockToUtc(...endDate, ...endTime, timeZone)
    : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
  // A published end time that lands at or before the start (e.g. a typo, or a
  // session running past midnight recorded without an end date) would make the
  // entry invalid — fall back to the default duration.
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
  }
  return { allDay: false, start, end };
};

const calendarTitle = (event) => event?.title || event?.name || 'Trading card event';

const calendarLocation = (event) =>
  [event?.venue_name, event?.address, event?.suburb, event?.state, event?.postcode]
    .filter(Boolean)
    .join(', ') || event?.location || formatEventLocation(event || {});

const calendarDescription = (event) => {
  const summary = event?.short_description || event?.description || '';
  const trimmed = summary.length > 500 ? `${summary.slice(0, 497).trimEnd()}…` : summary;
  return [trimmed, `Event details: ${eventUrl(event || {})}`].filter(Boolean).join('\n\n');
};

/** Google Calendar "create event" template URL. */
export const googleCalendarUrl = (event) => {
  const span = eventCalendarSpan(event);
  if (!span) return null;
  const dates = span.allDay
    ? `${dateStamp(span.start)}/${dateStamp(span.end)}`
    : `${utcStamp(span.start)}/${utcStamp(span.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: calendarTitle(event),
    dates,
    details: calendarDescription(event),
    location: calendarLocation(event),
    ctz: eventTimeZone(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/** Outlook Web "compose event" URL (works for outlook.com and Microsoft 365). */
export const outlookCalendarUrl = (event) => {
  const span = eventCalendarSpan(event);
  if (!span) return null;
  const isoDate = ([y, mo, d]) => `${y}-${pad(mo)}-${pad(d)}`;
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: calendarTitle(event),
    body: calendarDescription(event),
    location: calendarLocation(event),
    startdt: span.allDay ? isoDate(span.start) : span.start.toISOString(),
    enddt: span.allDay ? isoDate(span.end) : span.end.toISOString(),
    ...(span.allDay ? { allday: 'true' } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

// RFC 5545 §3.3.11 — backslash, semicolon and comma are escaped, newlines
// become a literal \n.
const escapeIcsText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// RFC 5545 §3.1 — content lines are folded at 75 octets with a leading space
// on continuations. Folding by code unit is close enough for our ASCII-ish
// content and never splits a surrogate pair.
const foldIcsLine = (line) => {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) chunks.push(` ${line.slice(i, i + 74)}`);
  return chunks.join('\r\n');
};

/** Build a single-event .ics document (Apple Calendar, Outlook desktop, etc.). */
export const buildEventIcs = (event, now = new Date()) => {
  const span = eventCalendarSpan(event);
  if (!span) return null;

  const uid = `${event?.slug || event?.id || dateStamp(span.allDay ? span.start : [0, 0, 0])}@cardpop.com.au`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CardPop Australia//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    span.allDay
      ? `DTSTART;VALUE=DATE:${dateStamp(span.start)}`
      : `DTSTART:${utcStamp(span.start)}`,
    span.allDay ? `DTEND;VALUE=DATE:${dateStamp(span.end)}` : `DTEND:${utcStamp(span.end)}`,
    `SUMMARY:${escapeIcsText(calendarTitle(event))}`,
    `DESCRIPTION:${escapeIcsText(calendarDescription(event))}`,
    `LOCATION:${escapeIcsText(calendarLocation(event))}`,
    `URL:${escapeIcsText(eventUrl(event || {}))}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
};

export const icsFileName = (event) =>
  `${String(event?.slug || calendarTitle(event))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cardpop-event'}.ics`;

/**
 * Hand the .ics to the browser. Apple Calendar (macOS/iOS) and Outlook desktop
 * both take over from the downloaded file.
 */
export const downloadEventIcs = (event) => {
  const ics = buildEventIcs(event);
  if (!ics) return false;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = icsFileName(event);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke late: Safari reads the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
};
