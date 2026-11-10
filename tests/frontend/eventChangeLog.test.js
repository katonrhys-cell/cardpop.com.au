import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVENT_LOGGED_FIELDS, OFFER_LOGGED_FIELDS, EVENT_CHANGE_LABELS, describeEventValue, normaliseEventValue,
  mergeChangeLog, changeRows,
} from '../../utils/eventChangeLog.js';

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');

// public.event_logged_fields() as last defined across the migrations.
function latestSqlFields() {
  let fields = null;
  for (const file of fs.readdirSync(MIGRATIONS).sort()) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    const body = sql.match(/function public\.event_logged_fields\(\)[\s\S]*?select array\[([\s\S]*?)\]::text\[\]/);
    if (body) fields = [...body[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }
  return fields;
}

describe('EVENT_LOGGED_FIELDS', () => {
  it('matches the latest public.event_logged_fields() in the migrations', () => {
    expect(latestSqlFields()).toEqual(EVENT_LOGGED_FIELDS);
  });

  it('has a label for every event and offer field', () => {
    for (const f of [...EVENT_LOGGED_FIELDS, ...OFFER_LOGGED_FIELDS]) expect(EVENT_CHANGE_LABELS[f]).toBeTruthy();
  });

  it('matches the offer field names the offer trigger logs', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, '20261110002320_event_organiser_offers_and_admin_alerts.sql'), 'utf8');
    const map = sql.match(/v_map constant jsonb := '(\{[^']+\})'/);
    expect(Object.values(JSON.parse(map[1]))).toEqual(OFFER_LOGGED_FIELDS);
  });
});

describe('mergeChangeLog', () => {
  it('keeps each field\'s first "from" and last "to"', () => {
    const merged = mergeChangeLog([
      { created_at: '2026-11-10T02:00:00Z', changes: { venue_name: { from: 'B', to: 'C' }, discount_code: { from: 'X', to: 'Y' } } },
      { created_at: '2026-11-10T01:00:00Z', changes: { venue_name: { from: 'A', to: 'B' } } },
    ]);
    expect(merged).toEqual({ venue_name: { from: 'A', to: 'C' }, discount_code: { from: 'X', to: 'Y' } });
  });

  it('drops a field that ended where it started', () => {
    expect(mergeChangeLog([
      { created_at: '1', changes: { title: { from: 'Show', to: 'Shwo' } } },
      { created_at: '2', changes: { title: { from: 'Shwo', to: 'Show' } } },
    ])).toEqual({});
  });
});

describe('changeRows', () => {
  it('labels rows in form order', () => {
    expect(changeRows({ discount_code: { from: 'A', to: 'B' }, title: { from: 'x', to: 'y' } })).toEqual([
      { field: 'title', label: 'Title', from: 'x', to: 'y' },
      { field: 'discount_code', label: 'Member ticket code', from: 'A', to: 'B' },
    ]);
  });
});

describe('describeEventValue / normaliseEventValue', () => {
  it('reads values for the admin view and the email', () => {
    expect(describeEventValue('title', '')).toBe('—');
    expect(describeEventValue('is_free', true)).toBe('Yes');
    expect(describeEventValue('entry_fee_aud', '12.5')).toBe('$12.50');
    expect(describeEventValue('tags', ['a', 'b'])).toBe('a, b');
    expect(describeEventValue('gallery_albums', [{ images: ['1', '2'] }, { images: ['3'] }])).toBe('2 albums, 3 photos');
    expect(describeEventValue('ticket_prices', [{ type: 'vip', price_aud: 40 }])).toBe('VIP: $40.00');
    expect(describeEventValue('start_time', '09:30:00')).toBe('09:30');
  });
  it('normalises blanks, times and numbers', () => {
    expect(normaliseEventValue('title', '  ')).toBeNull();
    expect(normaliseEventValue('tags', [])).toBeNull();
    expect(normaliseEventValue('capacity', '500')).toBe(500);
  });
});
