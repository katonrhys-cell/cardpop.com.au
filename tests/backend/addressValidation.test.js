import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { validateShippingAddress } from '../../src/utils/addressValidation.js';

function fetchResponse(body = {}, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

const REAL = { address: '1 Martin Place', suburb: 'Sydney', state: 'NSW', postcode: '2000' };
const ORIGINAL_KEY = process.env.GOOGLE_MAPS_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_ADDRESS_VALIDATION_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = ORIGINAL_KEY;
});

describe('validateShippingAddress', () => {
  it('fails open (skipped) when no API key is configured', async () => {
    const result = await validateShippingAddress(REAL);
    expect(result).toEqual({ valid: true, skipped: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an incomplete address without calling Google', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key';
    const result = await validateShippingAddress({ address: '1 Martin Place' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('incomplete');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a premise-level, deliverable address', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      result: { verdict: { validationGranularity: 'PREMISE' }, address: { formattedAddress: '1 Martin Place, Sydney NSW 2000' } },
    }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(true);
    expect(result.granularity).toBe('PREMISE');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('addressvalidation.googleapis.com');
    expect(url).toContain('key=key');
    const body = JSON.parse(options.body);
    expect(body.address.regionCode).toBe('AU');
    expect(body.address.addressLines[0]).toBe('1 Martin Place');
    expect(body.address.addressLines[1]).toBe('Sydney NSW 2000');
  });

  it('prepends a unit / apartment line when supplied', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      result: { verdict: { validationGranularity: 'SUB_PREMISE' } },
    }));
    await validateShippingAddress({ ...REAL, address2: 'Unit 5' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.address.addressLines[0]).toBe('Unit 5, 1 Martin Place');
  });

  it('rejects a vague (route-only) match as not deliverable', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({
      result: { verdict: { validationGranularity: 'ROUTE' } },
    }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not-deliverable');
  });

  it('fails closed (request-failed) when Google returns an error status', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key';
    global.fetch.mockResolvedValue(fetchResponse({}, { ok: false, status: 500 }));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('request-failed');
  });

  it('fails closed when the request throws', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key';
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await validateShippingAddress(REAL);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('request-failed');
  });
});
