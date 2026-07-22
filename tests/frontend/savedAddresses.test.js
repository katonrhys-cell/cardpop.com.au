import { describe, it, expect, vi } from 'vitest';

// The module imports the Supabase client at load time; stub it so these pure
// helpers can be tested without a real client.
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));

import {
  splitName,
  joinName,
  addressRowToShipping,
  formatAddressLabel,
} from '@/lib/savedAddresses.js';

describe('savedAddresses — name helpers', () => {
  it('splits a full name, keeping multi-word surnames intact', () => {
    expect(splitName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(splitName('Ada Lovelace King')).toEqual({ firstName: 'Ada', lastName: 'Lovelace King' });
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
    expect(splitName('  ')).toEqual({ firstName: '', lastName: '' });
    expect(splitName(null)).toEqual({ firstName: '', lastName: '' });
  });

  it('joins names and drops empty parts', () => {
    expect(joinName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(joinName('Ada', '')).toBe('Ada');
    expect(joinName('', '')).toBe('');
  });
});

describe('savedAddresses — row mapping', () => {
  const row = {
    id: 'a1',
    label: 'Home',
    full_name: 'Ada Lovelace',
    address_line1: '12 Smith St',
    address_line2: 'Unit 4',
    suburb: 'Bondi',
    state: 'NSW',
    postcode: '2026',
  };

  it('maps a saved row into the checkout shipping shape (pre-verified)', () => {
    expect(addressRowToShipping(row, 'a@b.com')).toEqual({
      email: 'a@b.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      address: '12 Smith St',
      address2: 'Unit 4',
      suburb: 'Bondi',
      state: 'NSW',
      postcode: '2026',
      verified: true,
    });
  });

  it('returns just the email when there is no row', () => {
    expect(addressRowToShipping(null, 'a@b.com')).toEqual({ email: 'a@b.com' });
  });

  it('builds a readable one-line label', () => {
    expect(formatAddressLabel(row)).toBe('12 Smith St, Unit 4, Bondi NSW 2026');
    expect(formatAddressLabel({ address_line1: '1 A St', suburb: 'Town', state: 'VIC', postcode: '3000' }))
      .toBe('1 A St, Town VIC 3000');
  });
});
