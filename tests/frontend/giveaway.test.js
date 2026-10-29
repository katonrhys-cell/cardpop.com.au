import { describe, it, expect } from 'vitest';
import {
  giveawayPhase, canDraw, normaliseInstagramHandle, isValidInstagramHandle, isAustralianPostcode,
  cleanPrizes, prizeKeyFromLabel, prizeForEntry, tallyPrizePicks,
} from '@/utils/giveaway.js';

const base = { status: 'open', opens_at: '2026-11-01T00:00:00Z', closes_at: '2026-11-09T09:00:00Z' };

describe('giveawayPhase', () => {
  it('reads the window while status is open', () => {
    expect(giveawayPhase(base, new Date('2026-10-31T00:00:00Z'))).toBe('upcoming');
    expect(giveawayPhase(base, new Date('2026-11-05T00:00:00Z'))).toBe('open');
    expect(giveawayPhase(base, new Date('2026-11-09T09:00:00Z'))).toBe('closed');
  });
  it('lets the admin status win outside the window', () => {
    expect(giveawayPhase({ ...base, status: 'draft' }, new Date('2026-11-05T00:00:00Z'))).toBe('hidden');
    expect(giveawayPhase({ ...base, status: 'cancelled' })).toBe('hidden');
    expect(giveawayPhase({ ...base, status: 'closed' }, new Date('2026-11-05T00:00:00Z'))).toBe('closed');
    expect(giveawayPhase({ ...base, status: 'drawn' }, new Date('2026-11-05T00:00:00Z'))).toBe('drawn');
    expect(giveawayPhase(null)).toBe('hidden');
  });
  it('only allows a draw once entries have closed', () => {
    expect(canDraw(base, new Date('2026-11-05T00:00:00Z'))).toBe(false);
    expect(canDraw(base, new Date('2026-11-10T00:00:00Z'))).toBe(true);
    expect(canDraw({ ...base, status: 'drawn' }, new Date('2026-11-10T00:00:00Z'))).toBe(false);
  });
});

describe('instagram handle + postcode checks', () => {
  it('normalises like the DB trigger', () => {
    expect(normaliseInstagramHandle('  @CardPop.AU ')).toBe('cardpop.au');
    expect(normaliseInstagramHandle('@@x')).toBe('x');
    expect(normaliseInstagramHandle(null)).toBe('');
  });
  it('validates handles', () => {
    expect(isValidInstagramHandle('@card_pop.au')).toBe(true);
    expect(isValidInstagramHandle('has space')).toBe(false);
    expect(isValidInstagramHandle('')).toBe(false);
    expect(isValidInstagramHandle('a'.repeat(31))).toBe(false);
  });
  it('validates Australian postcodes', () => {
    expect(isAustralianPostcode('3032')).toBe(true);
    expect(isAustralianPostcode(' 0800 ')).toBe(true);
    expect(isAustralianPostcode('30321')).toBe(false);
    expect(isAustralianPostcode('abcd')).toBe(false);
  });
});

describe('prizes', () => {
  it('slugs labels into keys', () => {
    expect(prizeKeyFromLabel('Sacha Boisvert')).toBe('sacha-boisvert');
    expect(prizeKeyFromLabel('  Émile  Héroux! ')).toBe('emile-heroux');
  });
  it('cleans, keys and de-duplicates prizes', () => {
    const out = cleanPrizes([
      { label: 'Sacha Boisvert', detail: '2026-27 UD S1 YG #243', image_url: 'https://x/y.jpg' },
      { label: '  ', detail: 'blank' },
      { label: 'Sacha Boisvert' },
      { key: 'eklund', label: 'Victor Eklund', image_url: 'javascript:alert(1)' },
    ]);
    expect(out).toEqual([
      { key: 'sacha-boisvert', label: 'Sacha Boisvert', detail: '2026-27 UD S1 YG #243', image_url: 'https://x/y.jpg' },
      { key: 'sacha-boisvert-2', label: 'Sacha Boisvert' },
      { key: 'eklund', label: 'Victor Eklund' },
    ]);
  });
  it('resolves the prize an entry named, or the only prize', () => {
    const g = { entry_mode: 'pick_prize', prizes: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] };
    expect(prizeForEntry(g, { prize_key: 'b' })).toEqual({ key: 'b', label: 'B' });
    expect(prizeForEntry(g, { prize_key: 'zzz' })).toBeNull();
    expect(prizeForEntry({ ...g, entry_mode: 'single_prize' }, { prize_key: null })).toEqual({ key: 'a', label: 'A' });
  });
  it('tallies picks per prize', () => {
    const g = { prizes: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] };
    expect(tallyPrizePicks(g, [{ prize_key: 'a' }, { prize_key: 'a' }, { prize_key: 'nope' }]))
      .toEqual([{ key: 'a', label: 'A', count: 2 }, { key: 'b', label: 'B', count: 0 }]);
  });
});
