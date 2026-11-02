import { describe, it, expect } from 'vitest';
import { organiserKey, findOrganiser, sortOrganisers } from '@/utils/eventOrganisers.js';

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
