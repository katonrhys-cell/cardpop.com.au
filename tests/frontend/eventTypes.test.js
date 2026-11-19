import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { EVENT_TYPES, EVENT_TYPE_VALUES, EVENT_FEATURE_OPTIONS, cleanEventFeatures } from '@/utils/eventTypes.js';
import { EVENT_TYPE_STYLES, EVENT_TYPE_LABELS } from '@/lib/eventSeo.js';

describe('event types', () => {
  it('gives every type a label and a pill style', () => {
    for (const t of EVENT_TYPES) {
      expect(EVENT_TYPE_LABELS[t.value]).toBeTruthy();
      expect(EVENT_TYPE_STYLES[t.value]).toBeTruthy();
    }
  });

  it('has an enum value in a migration for every type added after the original four', () => {
    const dir = 'supabase/migrations';
    const sql = readdirSync(dir).filter((f) => f.includes('event_type')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    const original = ['card_show', 'trade_event', 'community_event', 'lgs_event'];
    for (const v of EVENT_TYPE_VALUES.filter((x) => !original.includes(x))) {
      expect(sql).toContain(`add value if not exists '${v}'`);
    }
  });

  it('marks every type on the local map', () => {
    const src = readFileSync('pages/community/LocalMapPage.jsx', 'utf8');
    for (const v of EVENT_TYPE_VALUES) expect(src).toMatch(new RegExp(`\\b${v}:`));
  });
});

describe('cleanEventFeatures', () => {
  it('lists no option twice', () => {
    expect(new Set(EVENT_FEATURE_OPTIONS).size).toBe(EVENT_FEATURE_OPTIONS.length);
  });

  it('trims, de-duplicates and keeps the listed spelling', () => {
    expect(cleanEventFeatures(['  comics ', 'Comics', 'Pokémon', '', null, 'Model  Trains']))
      .toEqual(['Comics', 'Pokémon', 'Model Trains']);
  });

  it('drops over-long entries and non-arrays', () => {
    expect(cleanEventFeatures(['x'.repeat(41)])).toEqual([]);
    expect(cleanEventFeatures(null)).toEqual([]);
  });
});
