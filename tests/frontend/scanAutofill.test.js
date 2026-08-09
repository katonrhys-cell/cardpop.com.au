import { describe, it, expect } from 'vitest';
import {
  parseSerialNumber,
  isGenericSetName,
  pickSetByNameAndYear,
  matchTeam,
  matchParallel,
  finishFamilies,
  refractorColorValue,
} from '@/utils/scanAutofill.js';

// The fixture that drove these helpers: a 2025-26 Topps Chrome Jrue Holiday
// teal refractor, serial 097/199, whose scan read everything correctly but
// filled almost nothing in.

describe('parseSerialNumber', () => {
  it('splits a printed serial into position and print run, dropping leading zeros', () => {
    expect(parseSerialNumber('097/199')).toEqual({ position: '97', printRun: '199' });
    expect(parseSerialNumber('23 / 99')).toEqual({ position: '23', printRun: '99' });
    expect(parseSerialNumber('1/1')).toEqual({ position: '1', printRun: '1' });
  });

  it('rejects non-serials and misreads', () => {
    expect(parseSerialNumber('')).toBeNull();
    expect(parseSerialNumber(null)).toBeNull();
    expect(parseSerialNumber('SWSH114')).toBeNull();
    expect(parseSerialNumber('4/102/2')).toBeNull();
    expect(parseSerialNumber('250/199')).toBeNull(); // position beyond run
    expect(parseSerialNumber('0/0')).toBeNull();
  });
});

describe('isGenericSetName', () => {
  it('flags CardSight release names that carry no product information', () => {
    expect(isGenericSetName('Base Set')).toBe(true);
    expect(isGenericSetName('base')).toBe(true);
    expect(isGenericSetName(' BASE SET ')).toBe(true);
  });

  it('keeps real product names', () => {
    expect(isGenericSetName('Topps Chrome')).toBe(false);
    expect(isGenericSetName('Base Set 2')).toBe(false); // a distinct Pokemon set
    expect(isGenericSetName('')).toBe(false);
  });
});

describe('pickSetByNameAndYear', () => {
  const sets = [
    { id: 'a', name: '2024-25 Topps Chrome Basketball' },
    { id: 'b', name: '2025-26 Topps Chrome Basketball' },
    { id: 'c', name: '2025-26 Bowman Chrome Basketball' },
    { id: 'd', name: 'Prizm' },
  ];

  it('uses the year to pick the season of a multi-season product', () => {
    expect(pickSetByNameAndYear(sets, 'Topps Chrome', '2025-26')?.id).toBe('b');
    expect(pickSetByNameAndYear(sets, '2025-26 Topps Chrome', '')?.id).toBe('b');
  });

  it('accepts a single year for a season starting with it', () => {
    // Copyright lines often print only the first year ("©2025").
    expect(pickSetByNameAndYear(sets, 'Topps Chrome', '2025')?.id).toBe('b');
  });

  it('returns null rather than guessing between seasons', () => {
    expect(pickSetByNameAndYear(sets, 'Topps Chrome', '')).toBeNull();
    expect(pickSetByNameAndYear(sets, 'Topps Chrome', '1999')).toBeNull();
  });

  it('matches a lone candidate without needing a year', () => {
    expect(pickSetByNameAndYear(sets, 'Prizm', '')?.id).toBe('d');
  });

  it('returns null when nothing matches', () => {
    expect(pickSetByNameAndYear(sets, 'Donruss Optic', '2025')).toBeNull();
    expect(pickSetByNameAndYear(sets, '', '2025')).toBeNull();
  });
});

describe('matchTeam', () => {
  const teams = [
    { id: 'bos', name: 'Boston Celtics' },
    { id: 'lal', name: 'Los Angeles Lakers' },
    { id: 'lac', name: 'LA Clippers' },
  ];

  it('matches exactly, ignoring case and punctuation', () => {
    expect(matchTeam(teams, 'Boston Celtics')?.id).toBe('bos');
    expect(matchTeam(teams, 'boston celtics')?.id).toBe('bos');
  });

  it('matches by containment when unambiguous', () => {
    expect(matchTeam(teams, 'Celtics')?.id).toBe('bos');
    expect(matchTeam(teams, 'Boston Celtics Guard')?.id).toBe('bos');
  });

  it('refuses ambiguous or unknown names', () => {
    // "LA" is contained in both LA teams' names — ambiguous, so no pick.
    expect(matchTeam(teams, 'LA')).toBeNull();
    expect(matchTeam(teams, 'Chicago Bulls')).toBeNull();
    expect(matchTeam(teams, '')).toBeNull();
  });
});

describe('finishFamilies', () => {
  it('derives family words from finish chips', () => {
    expect(finishFamilies(['Chrome', 'Numbered'])).toEqual(['refractor']);
    expect(finishFamilies(['Refractor'])).toEqual(['refractor']);
    expect(finishFamilies(['Prizm', 'Chrome'])).toEqual(['prizm', 'refractor']);
    expect(finishFamilies(['Rookie Card (RC)'])).toEqual([]);
  });
});

describe('matchParallel', () => {
  // Modelled on the real NBA parallels table.
  const opts = [
    { id: 'teal', name: 'Teal Refractor /199', print_run: 199 },
    { id: 'blue-p', name: 'Blue Prizm /199', print_run: 199 },
    { id: 'blue-r', name: 'Blue Refractor /150', print_run: 150 },
    { id: 'gold-r', name: 'Gold Refractor /50', print_run: 50 },
    { id: 'refractor', name: 'Refractor', print_run: null },
  ];

  it('matches a printed parallel name, ignoring the /run suffix in the option', () => {
    expect(matchParallel(opts, { name: 'Teal Refractor' })?.id).toBe('teal');
    expect(matchParallel(opts, { name: 'GOLD REFRACTOR' })?.id).toBe('gold-r');
  });

  it('matches colour + print run', () => {
    expect(matchParallel(opts, { color: 'teal', printRun: '199' })?.id).toBe('teal');
  });

  it('matches print run + finish family — never crossing families', () => {
    // A /199 on a Chrome product is the teal refractor, not the Blue Prizm.
    expect(matchParallel(opts, { printRun: '199', families: ['refractor'] })?.id).toBe('teal');
    expect(matchParallel(opts, { printRun: '150', families: ['refractor'] })?.id).toBe('blue-r');
    // Without a family the /199 is ambiguous (teal refractor vs blue prizm).
    expect(matchParallel(opts, { printRun: '199' })).toBeNull();
  });

  it('matches colour + family for unnumbered parallels', () => {
    expect(matchParallel(opts, { color: 'gold', families: ['refractor'] })?.id).toBe('gold-r');
  });

  it('returns null with no usable signals or on ambiguity', () => {
    expect(matchParallel(opts, {})).toBeNull();
    expect(matchParallel(opts, { color: 'blue' })).toBeNull();
    expect(matchParallel(opts, { color: 'blue', families: ['refractor', 'prizm'] })).toBeNull();
  });
});

describe('refractorColorValue', () => {
  it('maps observed colour words to panel values', () => {
    expect(refractorColorValue('Teal')).toBe('teal');
    expect(refractorColorValue('CYAN')).toBe('aqua');
    expect(refractorColorValue('gold')).toBe('gold');
  });

  it('selects nothing for unknown colours', () => {
    expect(refractorColorValue('chartreuse')).toBe('');
    expect(refractorColorValue('')).toBe('');
    expect(refractorColorValue(null)).toBe('');
  });
});
