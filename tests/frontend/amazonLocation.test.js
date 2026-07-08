import { describe, it, expect } from 'vitest';

import { parsePlace } from '../../lib/amazonLocation.js';

const AWS_PLACE = {
  PlaceId: 'abc123',
  PlaceType: 'PointAddress',
  Address: {
    Label: '1 Martin Place, Sydney NSW 2000, Australia',
    Country: { Code2: 'AU', Code3: 'AUS', Name: 'Australia' },
    Region: { Code: 'NSW', Name: 'New South Wales' },
    Locality: 'Sydney',
    PostalCode: '2000',
    Street: 'Martin Place',
    AddressNumber: '1',
  },
};

describe('parsePlace', () => {
  it('maps an AWS place into the CardPop shipping shape', () => {
    expect(parsePlace(AWS_PLACE)).toEqual({
      address: '1 Martin Place',
      suburb: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      placeId: 'abc123',
      formatted: '1 Martin Place, Sydney NSW 2000, Australia',
      verified: true,
    });
  });

  it('strips an ISO "AU-" prefix from the region code', () => {
    const place = { ...AWS_PLACE, Address: { ...AWS_PLACE.Address, Region: { Code: 'AU-VIC' } } };
    expect(parsePlace(place).state).toBe('VIC');
  });

  it('falls back to District when Locality is absent', () => {
    const place = { ...AWS_PLACE, Address: { ...AWS_PLACE.Address, Locality: '', District: 'Parramatta' } };
    expect(parsePlace(place).suburb).toBe('Parramatta');
  });

  it('returns null for a non-Australian address', () => {
    const place = { ...AWS_PLACE, Address: { ...AWS_PLACE.Address, Country: { Code2: 'NZ' } } };
    expect(parsePlace(place)).toBeNull();
  });

  it('returns null when there is no street (a bare suburb / postcode pick)', () => {
    const place = { ...AWS_PLACE, Address: { ...AWS_PLACE.Address, Street: '', AddressNumber: '' } };
    expect(parsePlace(place)).toBeNull();
  });

  it('returns null for an unrecognised state', () => {
    const place = { ...AWS_PLACE, Address: { ...AWS_PLACE.Address, Region: { Code: 'ZZ' } } };
    expect(parsePlace(place)).toBeNull();
  });

  it('returns null when there is no address at all', () => {
    expect(parsePlace({})).toBeNull();
    expect(parsePlace(null)).toBeNull();
  });
});
