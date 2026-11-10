import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVENT_CHANGE_FIELDS, EVENT_CHANGE_LABELS, diffEventChanges, withRequestedChanges, describeEventValue, normaliseEventValue,
} from '../../utils/eventChangeRequests.js';

const MIGRATION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations/20261109235618_event_organiser_review_flow.sql');

// A live row as Supabase returns it.
const live = {
  id: 'evt-1',
  status: 'approved',
  title: 'CollectFest Melbourne',
  description: 'Big show.  ',
  start_date: '2027-03-06',
  start_time: '10:00:00',
  end_time: null,
  entry_fee_aud: 15,
  is_free: false,
  tags: ['pokemon'],
  featured_card_games: null,
  gallery_albums: [],
  gallery_images: ['https://x.test/a.webp'],
  event_videos: [],
  youtube_url: 'https://www.youtube.com/watch?v=abcdefghijk',
  ticket_prices: [],
  is_featured: true,
};

// What EventFormModal would save if the organiser touched nothing.
const untouched = {
  title: 'CollectFest Melbourne',
  description: 'Big show.',
  start_date: '2027-03-06',
  start_time: '10:00',
  end_time: null,
  entry_fee_aud: 15,
  is_free: false,
  tags: ['pokemon'],
  featured_card_games: null,
  gallery_albums: [{ title: '', images: ['https://x.test/a.webp'] }],
  gallery_images: ['https://x.test/a.webp'],
  event_videos: [{ title: '', url: 'https://www.youtube.com/watch?v=abcdefghijk' }],
  youtube_url: 'https://www.youtube.com/watch?v=abcdefghijk',
  ticket_prices: [],
  status: 'pending_review',
  is_featured: false,
  source_url: null,
};

describe('EVENT_CHANGE_FIELDS', () => {
  it('matches public.event_change_request_fields() in the migration', () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const body = sql.match(/function public\.event_change_request_fields\(\)[\s\S]*?select array\[([\s\S]*?)\]::text\[\]/);
    expect(body).not.toBeNull();
    const sqlFields = [...body[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(sqlFields).toEqual(EVENT_CHANGE_FIELDS);
  });

  it('never lets an organiser request status, featuring or ownership changes', () => {
    for (const f of ['status', 'is_featured', 'is_cardpop_verified', 'organiser_id', 'slug', 'source_url', 'auto_discovered']) {
      expect(EVENT_CHANGE_FIELDS).not.toContain(f);
    }
  });

  it('has a label for every field', () => {
    for (const f of EVENT_CHANGE_FIELDS) expect(EVENT_CHANGE_LABELS[f]).toBeTruthy();
  });
});

describe('diffEventChanges', () => {
  it('finds nothing when the organiser changed nothing (legacy photos/video, trimmed text, HH:MM times)', () => {
    expect(diffEventChanges(live, untouched)).toEqual({});
  });

  it('returns only the changed requestable fields, with the new values', () => {
    const changes = diffEventChanges(live, {
      ...untouched,
      start_time: '09:30',
      tags: ['pokemon', 'one piece'],
      venue_name: 'Melbourne Showgrounds',
    });
    expect(changes).toEqual({
      start_time: '09:30',
      tags: ['pokemon', 'one piece'],
      venue_name: 'Melbourne Showgrounds',
    });
  });

  it('ignores status / is_featured / source_url even when they differ', () => {
    expect(diffEventChanges(live, { ...untouched, status: 'approved', is_featured: true, source_url: 'https://x' })).toEqual({});
  });

  it('records a cleared field as null', () => {
    expect(diffEventChanges({ ...live, ticket_url: 'https://tix.test' }, { ...untouched, ticket_url: null }))
      .toEqual({ ticket_url: null });
  });

  it('treats a free event with no fee the same as a $0 fee', () => {
    expect(diffEventChanges({ ...live, is_free: true, entry_fee_aud: null }, { ...untouched, is_free: true, entry_fee_aud: 0 }))
      .toEqual({});
  });
});

describe('withRequestedChanges', () => {
  it('lays an open request over the live row', () => {
    expect(withRequestedChanges(live, { changes: { title: 'New' } })).toMatchObject({ id: 'evt-1', title: 'New', status: 'approved' });
  });
  it('returns the event itself with no request', () => {
    expect(withRequestedChanges(live, null)).toBe(live);
  });
});

describe('describeEventValue / normaliseEventValue', () => {
  it('reads values for the admin review dialog', () => {
    expect(describeEventValue('title', '')).toBe('—');
    expect(describeEventValue('is_free', true)).toBe('Yes');
    expect(describeEventValue('entry_fee_aud', '12.5')).toBe('$12.50');
    expect(describeEventValue('tags', ['a', 'b'])).toBe('a, b');
    expect(describeEventValue('gallery_albums', [{ images: ['1', '2'] }, { images: ['3'] }])).toBe('2 albums, 3 photos');
    expect(describeEventValue('ticket_prices', [{ type: 'vip', price_aud: 40 }])).toBe('VIP: $40.00');
  });
  it('normalises blanks, times and numbers', () => {
    expect(normaliseEventValue('title', '  ')).toBeNull();
    expect(normaliseEventValue('tags', [])).toBeNull();
    expect(normaliseEventValue('start_time', '10:00:00')).toBe('10:00');
    expect(normaliseEventValue('capacity', '500')).toBe(500);
  });
});
