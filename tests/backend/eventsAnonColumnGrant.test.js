import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Since 20261119050236_close_private_data_gaps.sql the anon role reads
// public.events through a per-column grant (so the organiser's private contact
// columns stay hidden). A column grant does not cover columns added later: a
// new public column would be unreadable through events_public and the
// prerender, and every anonymous event page would fail. Any later migration
// that adds a column to events must re-run the grant helper.
const DIR = join(process.cwd(), 'supabase/migrations');
const SINCE = '20261119050236';
const ADDS_EVENT_COLUMN = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?events\s+[^;]*\badd\s+column/i;
const REGRANTS = /private\.grant_events_anon_select\s*\(\s*\)/i;

describe('events anon column grant', () => {
  it('every migration that adds an events column after the grant re-runs it', () => {
    const offenders = readdirSync(DIR)
      .filter((f) => f.endsWith('.sql') && f.slice(0, 14) > SINCE)
      .filter((f) => {
        const sql = readFileSync(join(DIR, f), 'utf8');
        return ADDS_EVENT_COLUMN.test(sql) && !REGRANTS.test(sql);
      });
    expect(offenders, 'end these migrations with: select private.grant_events_anon_select();').toEqual([]);
  });

  it('the grant migration keeps the private columns out', () => {
    const sql = readFileSync(join(DIR, `${SINCE}_close_private_data_gaps.sql`), 'utf8');
    for (const col of ['organizer_email', 'organizer_phone', 'organiser_id', 'source_url']) {
      expect(sql).toContain(`'${col}'`);
    }
  });

  it('the pattern recognises an events column migration', () => {
    expect(ADDS_EVENT_COLUMN.test('alter table public.events add column if not exists x text;')).toBe(true);
    expect(ADDS_EVENT_COLUMN.test('alter table public.events_public add column x text;')).toBe(false);
  });
});
