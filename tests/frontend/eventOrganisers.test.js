import { describe, it, expect } from 'vitest';
import {
  organiserKey, findOrganiser, sortOrganisers,
  organisersForEvent, organiserNameParts, organiserPath, namesOrganiser, ilikeContains,
} from '@/utils/eventOrganisers.js';

const list = [
  { id: '2', name: 'Sports Addicts Australia', logo_url: null },
  { id: '1', name: 'fast break trading cards pty ltd', logo_url: 'https://x.test/a.png' },
];

describe('event organisers helpers', () => {
  it('keys names ignoring case and spacing', () => {
    expect(organiserKey('  Fast  Break ')).toBe('fast break');
    expect(organiserKey(null)).toBe('');
  });
  it('finds a saved organiser by any spelling of its name', () => {
    expect(findOrganiser(list, 'Fast Break Trading Cards Pty Ltd')?.id).toBe('1');
    expect(findOrganiser(list, 'Nobody')).toBeNull();
    expect(findOrganiser(list, '')).toBeNull();
  });
  it('sorts alphabetically and drops malformed rows', () => {
    expect(sortOrganisers([...list, { id: '', name: 'x' }, null]).map(o => o.id)).toEqual(['1', '2']);
  });
});

const dir = [
  { id: 'fb', name: 'Fast Break Trading Cards Pty Ltd', slug: 'fast-break-trading-cards-pty-ltd' },
  { id: 'sa', name: 'Sports Addicts Australia', slug: 'sports-addicts-australia' },
  { id: 'cc', name: 'Cardcore', slug: 'cardcore' },
  { id: 'cce', name: 'Cardcore Events', slug: 'cardcore-events' },
];

describe('organiser links', () => {
  it('builds the organiser page path', () => {
    expect(organiserPath(dir[2])).toBe('/events/organisers/cardcore');
    expect(organiserPath({ name: 'x' })).toBeNull();
  });
  it('resolves an exact name first', () => {
    expect(organisersForEvent(dir, 'cardcore').map(o => o.id)).toEqual(['cc']);
  });
  it('resolves every organiser of a co-hosted event, in order', () => {
    const name = 'Fast Break Trading Cards Pty Ltd & Sports Addicts Australia';
    expect(organisersForEvent(dir, name).map(o => o.id)).toEqual(['fb', 'sa']);
    const parts = organiserNameParts(name, organisersForEvent(dir, name));
    expect(parts.map(p => [p.text, p.org?.id ?? null])).toEqual([
      ['Fast Break Trading Cards Pty Ltd', 'fb'], [' & ', null], ['Sports Addicts Australia', 'sa'],
    ]);
  });
  it('prefers the longer name and matches whole words only', () => {
    expect(organisersForEvent(dir, 'Cardcore Events & Friends').map(o => o.id)).toEqual(['cce']);
    expect(namesOrganiser('Hardcore Cards', 'Cardcore')).toBe(false);
    expect(organisersForEvent(dir, 'Someone Else')).toEqual([]);
  });
  it('escapes ilike wildcards', () => {
    expect(ilikeContains(' 100%_A\\B ')).toBe('%100\\%\\_A\\\\B%');
  });
});
