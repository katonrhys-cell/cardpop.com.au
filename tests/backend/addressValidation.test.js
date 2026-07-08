import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { validateShippingAddress } from '../../src/utils/addressValidation.js';

function fetchResponse(body = {}, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

const REAL = { address: '1 Martin Place', suburb: 'Sydney', state: 'NSW', postcode: '2000' };
const ORIGINAL_KEY = process.env.AWS_LOCATION_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  delete process.env.AWS_LOCATION_API_KEY;
  delete process.env.AWS_LOCATION_PLACES_KEY;
  delete process.env.AWS_LOCATION_REGION;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.AWS_LOCATION_API_KEY;
  else process.env.AWS_LOCATION_API_KEY = ORIGINAL_KEY;
});

describe('validateShippingAddress', () => {
  it('fails open (skipped) when no API key is configured', async () => {
    const result = await validateShippingAddress(REAL);
    expect(result).toEqual({ valid: true, skipped: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an incomplete address without calling AWS', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    const result = await validateShippingAddress({ address: '1 Martin Place' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('incomplete');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a point-address, deliverable match', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      ResultItems: [{
        PlaceType: 'PointAddress',
        MatchScores: { Overall: 0.97 },
        Address: { Label: '1 Martin Place, Sydney NSW 2000, Australia' },
      }],
    }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(true);
    expect(result.granularity).toBe('PointAddress');
    expect(result.formatted).toContain('Martin Place');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('places.geo.ap-southeast-2.amazonaws.com/v2/geocode');
    expect(url).toContain('key=key');
    const body = JSON.parse(options.body);
    expect(body.Filter.IncludeCountries).toEqual(['AUS']);
    expect(body.QueryText).toBe('1 Martin Place, Sydney NSW 2000');
  });

  it('honours a custom AWS_LOCATION_REGION', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    process.env.AWS_LOCATION_REGION = 'us-east-1';
    global.fetch.mockResolvedValue(fetchResponse({
      ResultItems: [{ PlaceType: 'PointAddress', MatchScores: { Overall: 0.9 } }],
    }));
    await validateShippingAddress(REAL);
    expect(global.fetch.mock.calls[0][0]).toContain('places.geo.us-east-1.amazonaws.com');
  });

  it('prepends a unit / apartment line when supplied', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      ResultItems: [{ PlaceType: 'InterpolatedAddress', MatchScores: { Overall: 0.85 } }],
    }));
    await validateShippingAddress({ ...REAL, address2: 'Unit 5' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.QueryText).toBe('Unit 5, 1 Martin Place, Sydney NSW 2000');
  });

  it('rejects a vague (street-only) match as not deliverable', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      ResultItems: [{ PlaceType: 'Street', MatchScores: { Overall: 0.95 } }],
    }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not-deliverable');
  });

  it('rejects a low-confidence match even at premise granularity', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      ResultItems: [{ PlaceType: 'PointAddress', MatchScores: { Overall: 0.5 } }],
    }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not-deliverable');
  });

  it('rejects when AWS returns no results', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({ ResultItems: [] }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not-deliverable');
  });

  it('fails closed (request-failed) when AWS returns an error status', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({}, { ok: false, status: 500 }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('request-failed');
  });

  it('fails closed when the request throws', async () => {
    process.env.AWS_LOCATION_API_KEY = 'key';
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('request-failed');
  });
});
