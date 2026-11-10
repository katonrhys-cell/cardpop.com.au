import { describe, it, expect } from 'vitest';
import { seriesStem, sameOrganiser, isSameSeries, pickNextEdition } from '@/utils/eventNextEdition.js';

const TODAY = '2026-11-06';

describe('seriesStem', () => {
  it('drops years, months, days and edition numbers', () => {
    expect(seriesStem('Perth Card Fest 7 — November 2026')).toBe('perth card fest');
    expect(seriesStem('Perth Card Fest 8')).toBe('perth card fest');
    expect(seriesStem('Big Boyz Card Show – 20th Sept 2026')).toBe('big boyz card show');
    expect(seriesStem('Adelaide Pokémon Card Show #4')).toBe('adelaide pokemon card show');
  });
});

describe('sameOrganiser', () => {
  it('matches exact names, case and spacing aside, and a longer name that contains the shorter', () => {
    expect(sameOrganiser('The Hobby Hangout', 'the  hobby hangout')).toBe(true);
    expect(sameOrganiser('Supanova', 'Supanova Pop Culture Industries')).toBe(true);
    expect(sameOrganiser('Collector Con', 'Collectorama Melbourne')).toBe(false);
    expect(sameOrganiser('Card Fest', 'Perth Card Fest')).toBe(false);
    expect(sameOrganiser('Cardcore', 'Cardcore Events')).toBe(true);
    expect(sameOrganiser('Hobby Hangout', 'The Hobby Hangout')).toBe(true);
    expect(sameOrganiser('', 'Supanova')).toBe(false);
  });
});

describe('isSameSeries', () => {
  it('falls back to the title stem, but never on a one-word stem', () => {
    expect(isSameSeries({ title: 'Perth Card Fest 7' }, { title: 'Perth Card Fest 8' })).toBe(true);
    expect(isSameSeries({ title: 'Expo 2026' }, { title: 'Expo 2027' })).toBe(false);
  });
});

describe('pickNextEdition', () => {
  const past = { id: 'a', title: 'Hobby Hangout XL Sydney 2026', organizer_name: 'The Hobby Hangout', state: 'NSW', start_date: '2026-11-01' };

  it('returns the next edition by the same organiser in another city', () => {
    const next = { id: 'b', status: 'approved', title: 'Hobby Hangout XL Melbourne 2027', organizer_name: 'The Hobby Hangout', state: 'VIC', start_date: '2027-04-24' };
    const other = { id: 'c', status: 'approved', title: 'TCXPO Oran Park', organizer_name: 'TCXPO', state: 'NSW', start_date: '2026-12-06' };
    expect(pickNextEdition(past, [other, next], TODAY)).toBe(next);
  });

  it('prefers the same state, then the earliest date', () => {
    const brisbane = { id: 'x', title: 'Supanova Brisbane 2026', organizer_name: 'Supanova', state: 'QLD', start_date: '2026-11-06', end_date: '2026-11-08' };
    const melbourne = { id: 'm', status: 'approved', title: 'Supanova Melbourne 2027', organizer_name: 'Supanova Pop Culture Industries', state: 'VIC', start_date: '2027-04-16' };
    const goldCoast = { id: 'g', status: 'approved', title: 'Supanova Gold Coast 2027', organizer_name: 'Supanova Pop Culture Industries', state: 'QLD', start_date: '2027-04-10' };
    const sydney = { id: 's', status: 'approved', title: 'Supanova Sydney 2027', organizer_name: 'Supanova Pop Culture Industries', state: 'NSW', start_date: '2027-01-01' };
    expect(pickNextEdition(brisbane, [sydney, melbourne, goldCoast], '2026-11-09')).toBe(goldCoast);
  });

  it('ignores itself, unapproved rows, past dates and editions before the event ended', () => {
    const cands = [
      { ...past, status: 'approved' },
      { id: 'p', status: 'pending', title: 'Hobby Hangout XL Perth', organizer_name: 'The Hobby Hangout', start_date: '2027-01-01' },
      { id: 'q', status: 'approved', title: 'Hobby Hangout XL Brisbane', organizer_name: 'The Hobby Hangout', start_date: '2026-10-01' },
    ];
    expect(pickNextEdition(past, cands, TODAY)).toBeNull();
  });

  it('is null without a usable today or candidate list', () => {
    expect(pickNextEdition(past, null, TODAY)).toBeNull();
    expect(pickNextEdition(past, [], 'not-a-date')).toBeNull();
  });
});
