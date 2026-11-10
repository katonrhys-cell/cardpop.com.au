import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: fetchMock } }));

import { buildGeocodeQuery, geocodeBatch, STATE_CENTROIDS } from '@/lib/geocode.js';

beforeEach(() => { fetchMock.mockReset(); });

describe('buildGeocodeQuery', () => {
  it('uses the most precise fields available', () => {
    expect(buildGeocodeQuery({ address: '1 King St', suburb: 'Newtown', state: 'NSW' })).toBe('1 King St, Newtown, NSW');
    expect(buildGeocodeQuery({ venueName: 'Town Hall', suburb: 'Hobart', state: 'TAS' })).toBe('Town Hall, Hobart, TAS');
    expect(buildGeocodeQuery({ suburb: 'Fitzroy', state: 'VIC' })).toBe('Fitzroy, VIC');
    expect(buildGeocodeQuery({ state: 'QLD' })).toBeNull();
  });
});

describe('geocodeBatch', () => {
  it('sends one request and maps answers back in order, falling back to the state centroid', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: { 'fitzroy, vic': [-37.8, 144.98] }, pending: ['newtown, nsw'] }) });
    const coords = await geocodeBatch([
      { suburb: 'Fitzroy', state: 'VIC' },
      { suburb: 'Newtown', state: 'NSW' },
      { state: 'WA' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).queries).toEqual(['Fitzroy, VIC', 'Newtown, NSW']);
    expect(coords).toEqual([[-37.8, 144.98], STATE_CENTROIDS.NSW, STATE_CENTROIDS.WA]);
  });

  it('places everything on state centroids when the request fails', async () => {
    fetchMock.mockImplementation(async () => { throw new TypeError('offline'); });
    expect(await geocodeBatch([{ suburb: 'Fitzroy', state: 'VIC' }])).toEqual([STATE_CENTROIDS.VIC]);
  });
});
