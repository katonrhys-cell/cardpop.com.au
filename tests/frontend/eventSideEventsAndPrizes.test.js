import { describe, it, expect } from 'vitest';
import {
  cleanSideEvents, sortSideEvents, groupSideEventsByDay, formatSideEventDay, formatSideEventTime,
  formatSideEventFee, sideEventsFormError, sideEventsToForm, buildSubEventLds, MAX_SIDE_EVENTS,
} from '@/utils/eventSideEvents.js';
import {
  cleanEventPrizes, cleanPrizePool, hasPrizes, prizeImageUrls, MAX_PRIZE_PHOTOS, MAX_EVENT_PRIZES,
} from '@/utils/eventPrizes.js';

describe('cleanSideEvents', () => {
  it('keeps valid entries, trims text and normalises times, fees, caps and links', () => {
    expect(cleanSideEvents([{
      title: '  Classic Constructed ', date: '2026-11-14', start_time: '09:00:00', end_time: '17:30',
      entry_fee_aud: '120', player_cap: '250', description: ' Day 1 ', url: 'https://example.com/reg',
    }])).toEqual([{
      title: 'Classic Constructed', date: '2026-11-14', start_time: '09:00', end_time: '17:30',
      entry_fee_aud: 120, player_cap: 250, description: 'Day 1', url: 'https://example.com/reg',
    }]);
  });

  it('drops nameless entries and blanks impossible dates, times, fees, caps and unsafe links', () => {
    const out = cleanSideEvents([
      { title: '', date: '2026-11-14' },
      { title: 'Bad', date: '2026-02-31', start_time: '25:00', entry_fee_aud: '-5', player_cap: '0', url: 'javascript:alert(1)' },
      null,
    ]);
    expect(out).toEqual([{
      title: 'Bad', date: '', start_time: '', end_time: '', entry_fee_aud: null, player_cap: null, description: '', url: '',
    }]);
  });

  it('treats 0 as a free fee but blank as not stated, and caps the list', () => {
    const [free, unstated] = cleanSideEvents([{ title: 'a', entry_fee_aud: 0 }, { title: 'b', entry_fee_aud: '' }]);
    expect(free.entry_fee_aud).toBe(0);
    expect(unstated.entry_fee_aud).toBeNull();
    expect(cleanSideEvents(Array.from({ length: MAX_SIDE_EVENTS + 5 }, (_, i) => ({ title: `t${i}` })))).toHaveLength(MAX_SIDE_EVENTS);
    expect(cleanSideEvents(null)).toEqual([]);
  });
});

describe('schedule ordering and formatting', () => {
  const list = cleanSideEvents([
    { title: 'Sunday showdown', date: '2026-11-15', start_time: '09:00' },
    { title: 'TBC', date: '' },
    { title: 'Saturday main', date: '2026-11-14', start_time: '09:00' },
    { title: 'Friday late', date: '2026-11-13', start_time: '13:00' },
    { title: 'Friday untimed', date: '2026-11-13' },
    { title: 'Friday early', date: '2026-11-13', start_time: '09:00' },
  ]);

  it('sorts by day, then start time, with undated and untimed last', () => {
    expect(sortSideEvents(list).map((e) => e.title)).toEqual([
      'Friday early', 'Friday late', 'Friday untimed', 'Saturday main', 'Sunday showdown', 'TBC',
    ]);
  });

  it('groups by day', () => {
    expect(groupSideEventsByDay(list).map((g) => [g.date, g.events.length])).toEqual([
      ['2026-11-13', 3], ['2026-11-14', 1], ['2026-11-15', 1], ['', 1],
    ]);
  });

  it('formats days, times and fees', () => {
    expect(formatSideEventDay('2026-11-13')).toBe('Friday 13 November');
    expect(formatSideEventDay('nope')).toBe('');
    expect(formatSideEventTime({ start_time: '09:00' })).toBe('9:00 AM');
    expect(formatSideEventTime({ start_time: '12:05', end_time: '17:30' })).toBe('12:05 PM – 5:30 PM');
    expect(formatSideEventTime({ start_time: '', end_time: '17:30' })).toBe('');
    expect(formatSideEventTime({ start_time: '00:00' })).toBe('12:00 AM');
    expect(formatSideEventFee({ entry_fee_aud: 0 })).toBe('Free');
    expect(formatSideEventFee({ entry_fee_aud: 120 })).toBe('$120.00');
    expect(formatSideEventFee({ entry_fee_aud: null })).toBe('');
  });
});

describe('form helpers', () => {
  it('round-trips stored events into string rows', () => {
    expect(sideEventsToForm([{ title: 'a', entry_fee_aud: 0, player_cap: 8 }])[0]).toMatchObject({
      title: 'a', entry_fee_aud: '0', player_cap: '8', date: '',
    });
  });

  it('requires a name on any row that has content, a usable link and a numeric fee', () => {
    expect(sideEventsFormError([])).toBeNull();
    expect(sideEventsFormError([{ title: '', date: '', start_time: '', end_time: '', entry_fee_aud: '', player_cap: '', description: '', url: '' }])).toBeNull();
    expect(sideEventsFormError([{ title: '', date: '2026-11-14' }])).toMatch(/needs a name/);
    expect(sideEventsFormError([{ title: 'X', url: 'not a link' }])).toMatch(/registration link/);
    expect(sideEventsFormError([{ title: 'X', url: 'https://ok.example/reg', entry_fee_aud: 'abc' }])).toMatch(/entry fee/);
    expect(sideEventsFormError([{ title: 'X', url: 'https://ok.example/reg', entry_fee_aud: '0' }])).toBeNull();
  });
});

describe('buildSubEventLds', () => {
  it('emits a subEvent per dated side event, in schedule order, with the parent location and an offer', () => {
    const location = { '@type': 'Place', name: 'Club Central' };
    const lds = buildSubEventLds([
      { title: 'Sunday', date: '2026-11-15', start_time: '09:00', entry_fee_aud: 100 },
      { title: 'Saturday', date: '2026-11-14', start_time: '09:00', end_time: '18:00', url: 'https://example.com/r' },
      { title: 'Undated' },
    ], { location });
    expect(lds.map((l) => l.name)).toEqual(['Saturday', 'Sunday']);
    expect(lds[0]).toMatchObject({
      '@type': 'Event', startDate: '2026-11-14T09:00:00+10:00', endDate: '2026-11-14T18:00:00+10:00', location, url: 'https://example.com/r',
    });
    expect(lds[1].offers).toEqual({ '@type': 'Offer', price: 100, priceCurrency: 'AUD' });
    expect(lds[0].offers).toBeUndefined();
  });
});

describe('cleanEventPrizes', () => {
  it('keeps prizes with a place or reward, trimmed, with only safe image URLs', () => {
    expect(cleanEventPrizes([
      { place: ' 1st Place ', reward: '$1,500 USD', images: ['https://cdn.test/a.jpg', 'javascript:alert(1)', '/local.jpg'] },
      { place: '', reward: '', images: ['https://cdn.test/orphan.jpg'] },
      { place: '2nd', reward: '', images: [] },
    ])).toEqual([
      { place: '1st Place', reward: '$1,500 USD', images: ['https://cdn.test/a.jpg', '/local.jpg'] },
      { place: '2nd', reward: '', images: [] },
    ]);
  });

  it('caps photos per prize and the number of prizes', () => {
    const many = Array.from({ length: MAX_PRIZE_PHOTOS + 4 }, (_, i) => `https://cdn.test/${i}.jpg`);
    expect(cleanEventPrizes([{ place: '1st', images: many }])[0].images).toHaveLength(MAX_PRIZE_PHOTOS);
    expect(cleanEventPrizes(Array.from({ length: MAX_EVENT_PRIZES + 3 }, (_, i) => ({ place: `p${i}` })))).toHaveLength(MAX_EVENT_PRIZES);
    expect(cleanEventPrizes(undefined)).toEqual([]);
  });

  it('knows when there is anything to show and lists every photo in order', () => {
    expect(hasPrizes([], '')).toBe(false);
    expect(hasPrizes([], '  $5,000 USD ')).toBe(true);
    expect(cleanPrizePool('  $5,000 USD ')).toBe('$5,000 USD');
    expect(prizeImageUrls([{ place: 'a', images: ['https://x/1.jpg'] }, { place: 'b', images: ['https://x/2.jpg'] }]))
      .toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });
});
