import { describe, it, expect } from 'vitest';
import {
  eventTimeZone,
  eventCalendarSpan,
  googleCalendarUrl,
  outlookCalendarUrl,
  buildEventIcs,
  icsFileName,
} from '@/lib/addToCalendar.js';

// Melbourne Card Fair — a real listing shape: single day, 10am–3pm AEST.
const melbourneEvent = {
  id: 'a1b2',
  slug: 'melbourne-card-fair-thornbury-2026-08-02',
  title: 'Melbourne Card Fair — Thornbury',
  start_date: '2026-08-02',
  end_date: '2026-08-02',
  start_time: '10:00',
  end_time: '15:00',
  venue_name: 'Thornbury Theatre',
  address: '859 High St',
  suburb: 'Thornbury',
  state: 'VIC',
  postcode: '3071',
  short_description: 'Buy, sell and trade cards.',
};

describe('eventTimeZone', () => {
  it.each([
    ['VIC', 'Australia/Melbourne'],
    ['nsw', 'Australia/Sydney'],
    ['ACT', 'Australia/Sydney'],
    ['QLD', 'Australia/Brisbane'],
    ['WA', 'Australia/Perth'],
    ['NT', 'Australia/Darwin'],
    ['SA', 'Australia/Adelaide'],
    ['TAS', 'Australia/Hobart'],
  ])('maps %s to %s', (state, zone) => {
    expect(eventTimeZone({ state })).toBe(zone);
  });

  it('falls back to Sydney when the state is missing or unknown', () => {
    expect(eventTimeZone({})).toBe('Australia/Sydney');
    expect(eventTimeZone({ state: 'ZZ' })).toBe('Australia/Sydney');
  });
});

describe('eventCalendarSpan', () => {
  it('resolves wall-clock times against the venue state, not the browser', () => {
    const span = eventCalendarSpan(melbourneEvent);
    expect(span.allDay).toBe(false);
    // 2 Aug 2026 is winter — Melbourne is AEST (UTC+10), so 10:00 is 00:00Z.
    expect(span.start.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(span.end.toISOString()).toBe('2026-08-02T05:00:00.000Z');
  });

  it('honours daylight saving for a summer Melbourne event (UTC+11)', () => {
    const span = eventCalendarSpan({ ...melbourneEvent, start_date: '2026-12-05', end_date: '2026-12-05' });
    expect(span.start.toISOString()).toBe('2026-12-04T23:00:00.000Z');
  });

  it('keeps Brisbane on UTC+10 in summer (no daylight saving)', () => {
    const span = eventCalendarSpan({
      ...melbourneEvent, state: 'QLD', start_date: '2026-12-05', end_date: '2026-12-05',
    });
    // Same 10:00 wall clock as the Melbourne case above, but an hour later in
    // UTC because Brisbane stays on AEST while Melbourne moves to AEDT.
    expect(span.start.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });

  it('defaults to a two-hour block when no end time is published', () => {
    const { end_time, ...noEnd } = melbourneEvent;
    const span = eventCalendarSpan(noEnd);
    expect(span.end.getTime() - span.start.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('falls back to two hours when the end time is not after the start', () => {
    const span = eventCalendarSpan({ ...melbourneEvent, end_time: '09:00' });
    expect(span.end.getTime() - span.start.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('becomes an all-day entry when no start time is published', () => {
    const { start_time, end_time, ...noTime } = melbourneEvent;
    const span = eventCalendarSpan(noTime);
    // DTEND is exclusive for all-day entries — one day past the last day.
    expect(span).toMatchObject({ allDay: true, start: [2026, 8, 2], end: [2026, 8, 3] });
  });

  it('spans a multi-day event as an all-day range when the end time is unknown', () => {
    const { end_time, ...noEnd } = melbourneEvent;
    const span = eventCalendarSpan({ ...noEnd, end_date: '2026-08-04' });
    expect(span).toMatchObject({ allDay: true, start: [2026, 8, 2], end: [2026, 8, 5] });
  });

  it('returns null without a usable start date', () => {
    expect(eventCalendarSpan({ ...melbourneEvent, start_date: null })).toBeNull();
    expect(eventCalendarSpan(null)).toBeNull();
  });
});

describe('googleCalendarUrl', () => {
  it('builds a template URL with UTC stamps and the event timezone', () => {
    const url = new URL(googleCalendarUrl(melbourneEvent));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20260802T000000Z/20260802T050000Z');
    expect(url.searchParams.get('ctz')).toBe('Australia/Melbourne');
    expect(url.searchParams.get('text')).toBe('Melbourne Card Fair — Thornbury');
    expect(url.searchParams.get('location')).toBe('Thornbury Theatre, 859 High St, Thornbury, VIC, 3071');
    expect(url.searchParams.get('details')).toContain(
      'https://cardpop.com.au/events/melbourne-card-fair-thornbury-2026-08-02',
    );
  });

  it('uses bare dates for an all-day event', () => {
    const { start_time, end_time, ...noTime } = melbourneEvent;
    const url = new URL(googleCalendarUrl(noTime));
    expect(url.searchParams.get('dates')).toBe('20260802/20260803');
  });

  it('returns null without a start date', () => {
    expect(googleCalendarUrl({})).toBeNull();
  });
});

describe('outlookCalendarUrl', () => {
  it('builds a compose deeplink with ISO timestamps', () => {
    const url = new URL(outlookCalendarUrl(melbourneEvent));
    expect(url.searchParams.get('path')).toBe('/calendar/action/compose');
    expect(url.searchParams.get('rru')).toBe('addevent');
    expect(url.searchParams.get('startdt')).toBe('2026-08-02T00:00:00.000Z');
    expect(url.searchParams.get('allday')).toBeNull();
  });

  it('flags all-day events and uses bare dates', () => {
    const { start_time, end_time, ...noTime } = melbourneEvent;
    const url = new URL(outlookCalendarUrl(noTime));
    expect(url.searchParams.get('allday')).toBe('true');
    expect(url.searchParams.get('startdt')).toBe('2026-08-02');
    expect(url.searchParams.get('enddt')).toBe('2026-08-03');
  });
});

describe('buildEventIcs', () => {
  const ics = buildEventIcs(melbourneEvent, new Date('2026-07-01T00:00:00Z'));
  const unfold = (text) => text.replace(/\r\n /g, '');

  it('emits a well-formed single-event calendar', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(unfold(ics)).toContain('UID:melbourne-card-fair-thornbury-2026-08-02@cardpop.com.au');
    expect(ics).toContain('DTSTAMP:20260701T000000Z');
    expect(ics).toContain('DTSTART:20260802T000000Z');
    expect(ics).toContain('DTEND:20260802T050000Z');
    expect(unfold(ics)).toContain('SUMMARY:Melbourne Card Fair — Thornbury');
  });

  it('escapes commas in the location per RFC 5545', () => {
    expect(unfold(ics)).toContain(
      'LOCATION:Thornbury Theatre\\, 859 High St\\, Thornbury\\, VIC\\, 3071',
    );
  });

  it('folds content lines at 75 characters', () => {
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('uses DATE-valued bounds for an all-day event', () => {
    const { start_time, end_time, ...noTime } = melbourneEvent;
    const allDay = buildEventIcs(noTime, new Date('2026-07-01T00:00:00Z'));
    expect(allDay).toContain('DTSTART;VALUE=DATE:20260802');
    expect(allDay).toContain('DTEND;VALUE=DATE:20260803');
  });

  it('returns null without a start date', () => {
    expect(buildEventIcs({})).toBeNull();
  });
});

describe('icsFileName', () => {
  it('slugifies from the event slug', () => {
    expect(icsFileName(melbourneEvent)).toBe('melbourne-card-fair-thornbury-2026-08-02.ics');
  });

  it('falls back to the title, then to a generic name', () => {
    expect(icsFileName({ title: 'Sydney Card Show!' })).toBe('sydney-card-show.ics');
    expect(icsFileName({})).toBe('trading-card-event.ics');
  });
});
