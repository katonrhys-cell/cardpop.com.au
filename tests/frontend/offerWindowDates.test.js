import { describe, it, expect } from 'vitest';
import {
  openDateToTimestamp, closeDateToTimestamp, timestampToOpenDate, timestampToCloseDate, describeOfferWindow,
} from '@/utils/offerWindowDates.js';

describe('offer window dates', () => {
  it('opens at the start of the opening day and closes at the end of the closing day', () => {
    const open = new Date(openDateToTimestamp('2026-11-01'));
    const close = new Date(closeDateToTimestamp('2026-11-14'));
    expect([open.getFullYear(), open.getMonth(), open.getDate(), open.getHours()]).toEqual([2026, 10, 1, 0]);
    // Exclusive bound: midnight starting the 15th, so all of the 14th counts.
    expect([close.getMonth(), close.getDate(), close.getHours()]).toEqual([10, 15, 0]);
  });

  it('round-trips back to the picked dates', () => {
    expect(timestampToOpenDate(openDateToTimestamp('2026-11-01'))).toBe('2026-11-01');
    expect(timestampToCloseDate(closeDateToTimestamp('2026-11-14'))).toBe('2026-11-14');
    expect(timestampToCloseDate(closeDateToTimestamp('2026-12-31'))).toBe('2026-12-31');
  });

  it('treats blanks and junk as no date', () => {
    expect(openDateToTimestamp('')).toBeNull();
    expect(closeDateToTimestamp(null)).toBeNull();
    expect(openDateToTimestamp('next week')).toBeNull();
    expect(timestampToOpenDate(null)).toBe('');
  });

  it('describes the window for buyers', () => {
    const listing = { offers_open_at: openDateToTimestamp('2026-11-01'), offers_close_at: closeDateToTimestamp('2026-11-14') };
    expect(describeOfferWindow(listing, 'upcoming')).toMatch(/^Offers open .*1 Nov/);
    expect(describeOfferWindow(listing, 'open')).toMatch(/^Offers close .*14 Nov/);
    expect(describeOfferWindow(listing, 'closed')).toBe('Offers closed');
    expect(describeOfferWindow({}, 'open')).toBeNull();
  });
});
