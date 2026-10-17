import { describe, it, expect } from 'vitest';
import { filterEvents, sortEvents, defaultSortDir, EVENT_SORT_KEYS } from '@/utils/adminEventList.js';

const E = (o) => ({ status: 'approved', event_type: 'card_show', auto_discovered: false, is_featured: false, ...o });
const events = [
  E({ id: 'perth',    title: 'Supanova Comic Con & Gaming — Perth 2027',  state: 'WA',  suburb: 'Perth',     venue_name: 'PCEC',         start_date: '2027-06-25', end_date: '2027-06-27', created_at: '2026-10-01T00:00:00Z' }),
  E({ id: 'sydney',   title: 'Supanova Comic Con & Gaming — Sydney 2027', state: 'NSW', suburb: 'Olympic Park', venue_name: 'Sydney Showground', start_date: '2027-06-18', created_at: '2026-10-02T00:00:00Z' }),
  E({ id: 'tcxpo',    title: 'TCXPO Trading Card Expo – Oran Park',       state: 'NSW', suburb: 'Oran Park', status: 'cancelled', event_type: 'trade_event', start_date: '2027-05-16', tags: ['sports', 'tcg'], created_at: '2026-09-01T00:00:00Z' }),
  E({ id: 'hangout',  title: 'The Hobby Hangout XL Melbourne',            state: 'vic', suburb: 'Carlton', is_featured: true, start_date: '2027-04-24', featured_card_games: ['Pokémon'], created_at: '2026-08-01T00:00:00Z' }),
  E({ id: 'scanned',  title: 'Collector Con Penrith',                     state: 'NSW', status: 'pending_review', auto_discovered: true, event_type: 'community_event', start_date: '2026-09-20', created_at: '2026-09-15T00:00:00Z' }),
  E({ id: 'done',     title: 'Old Brisbane Swap Meet',                     state: 'QLD', status: 'completed', start_date: '2025-03-01', organizer_name: 'Brisbane Collectors Club' }),
  E({ id: 'undated',  title: 'Someday Show',                               state: null, start_date: null }),
];
const ids = (list) => list.map((e) => e.id);
const TODAY = '2026-10-17';

describe('filterEvents', () => {
  it('returns everything with no filters', () => {
    expect(filterEvents(events, {})).toHaveLength(events.length);
    expect(filterEvents(events, { status: 'all', type: 'all', state: 'all', when: 'all', source: 'all', search: '' })).toHaveLength(events.length);
  });

  it('matches every typed word against title, venue, suburb, tags, games and organiser', () => {
    expect(ids(filterEvents(events, { search: 'supanova perth' }))).toEqual(['perth']);
    expect(ids(filterEvents(events, { search: 'PCEC' }))).toEqual(['perth']);
    expect(ids(filterEvents(events, { search: 'oran park' }))).toEqual(['tcxpo']);
    expect(ids(filterEvents(events, { search: 'sports' }))).toEqual(['tcxpo']);
    expect(ids(filterEvents(events, { search: 'pokémon' }))).toEqual(['hangout']);
    expect(ids(filterEvents(events, { search: 'collectors club' }))).toEqual(['done']);
    expect(filterEvents(events, { search: 'no such event' })).toEqual([]);
  });

  it('filters by status, type and state (state case-insensitively)', () => {
    expect(ids(filterEvents(events, { status: 'cancelled' }))).toEqual(['tcxpo']);
    expect(ids(filterEvents(events, { status: 'pending_review' }))).toEqual(['scanned']);
    expect(ids(filterEvents(events, { type: 'trade_event' }))).toEqual(['tcxpo']);
    expect(ids(filterEvents(events, { state: 'NSW' }))).toEqual(['sydney', 'tcxpo', 'scanned']);
    expect(ids(filterEvents(events, { state: 'VIC' }))).toEqual(['hangout']);
  });

  it('splits upcoming from past using the viewer\'s local date', () => {
    expect(ids(filterEvents(events, { when: 'past' }, { today: TODAY }))).toEqual(['scanned', 'done']);
    expect(ids(filterEvents(events, { when: 'upcoming' }, { today: TODAY })))
      .toEqual(['perth', 'sydney', 'tcxpo', 'hangout', 'undated']);
  });

  it('filters by source: scan, hand-made or featured', () => {
    expect(ids(filterEvents(events, { source: 'scan' }))).toEqual(['scanned']);
    expect(ids(filterEvents(events, { source: 'featured' }))).toEqual(['hangout']);
    expect(ids(filterEvents(events, { source: 'manual' }))).not.toContain('scanned');
  });

  it('combines filters with the search term', () => {
    expect(ids(filterEvents(events, { search: 'supanova', state: 'NSW' }))).toEqual(['sydney']);
    expect(filterEvents(events, { search: 'supanova', status: 'cancelled' })).toEqual([]);
  });
});

describe('sortEvents', () => {
  it('defaults to event date, newest first, with undated rows last', () => {
    expect(ids(sortEvents(events))).toEqual(['perth', 'sydney', 'tcxpo', 'hangout', 'scanned', 'done', 'undated']);
  });

  it('sorts dates ascending but keeps blanks at the bottom', () => {
    expect(ids(sortEvents(events, 'date', 'asc'))).toEqual(['done', 'scanned', 'hangout', 'tcxpo', 'sydney', 'perth', 'undated']);
  });

  it('sorts by title, location and status', () => {
    expect(ids(sortEvents(events, 'title', 'asc')).slice(0, 2)).toEqual(['scanned', 'done']);
    expect(ids(sortEvents(events, 'location', 'asc')).slice(0, 3)).toEqual(['scanned', 'sydney', 'tcxpo']);
    expect(ids(sortEvents(events, 'location', 'asc')).at(-1)).toBe('undated');
    // Pending first — what needs a decision — then live, cancelled, completed.
    const byStatus = ids(sortEvents(events, 'status', 'asc'));
    expect(byStatus[0]).toBe('scanned');
    expect(byStatus.at(-2)).toBe('tcxpo');
    expect(byStatus.at(-1)).toBe('done');
  });

  it('sorts by date added and falls back to the date for an unknown key', () => {
    expect(ids(sortEvents(events, 'created', 'desc')).slice(0, 2)).toEqual(['sydney', 'perth']);
    expect(ids(sortEvents(events, 'nonsense'))).toEqual(ids(sortEvents(events, 'date', 'desc')));
  });

  it('does not mutate the input', () => {
    const copy = [...events];
    sortEvents(events, 'title', 'asc');
    expect(events).toEqual(copy);
  });

  it('starts date-like columns newest-first and text columns A→Z', () => {
    expect(defaultSortDir('date')).toBe('desc');
    expect(defaultSortDir('created')).toBe('desc');
    expect(defaultSortDir('title')).toBe('asc');
    expect(EVENT_SORT_KEYS).toEqual(['date', 'title', 'location', 'status', 'created', 'updated']);
  });
});
