import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { psaApiClient } from '../../../src/utils/psaApiClient.js';

function fetchResponse({ ok = true, status = 200, statusText = 'OK', body = {} } = {}) {
  return { ok, status, statusText, json: vi.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('psaApiClient.lookupCard', () => {
  it('throws when gradingNumber is missing or not a string', async () => {
    await expect(psaApiClient.lookupCard({ gradingNumber: '' })).rejects.toThrow(/gradingNumber is required/);
    await expect(psaApiClient.lookupCard({ gradingNumber: 12345 })).rejects.toThrow(/gradingNumber is required/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('queries the PSA cert endpoint with a bearer token and returns the cert', async () => {
    const cert = { PSACert: { CertNumber: '12345678', Grade: '10' } };
    global.fetch.mockResolvedValue(fetchResponse({ body: cert }));

    const result = await psaApiClient.lookupCard({ gradingNumber: '  12345678  ' });
    expect(result).toEqual(cert);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.psacard.com/publicapi/cert/GetByCertNumber/12345678'); // trimmed
    expect(options.headers.authorization).toBe('bearer vitest_dummy_psa_token');
  });

  it('returns null when the cert is not found (404)', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: false, status: 404, statusText: 'Not Found' }));
    const result = await psaApiClient.lookupCard({ gradingNumber: '99999999' });
    expect(result).toBeNull();
  });

  it('throws on a non-404 error response', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: false, status: 500, statusText: 'Server Error' }));
    await expect(psaApiClient.lookupCard({ gradingNumber: '123' }))
      .rejects.toThrow(/PSA API error: 500 Server Error/);
  });

  it('propagates a network/fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('socket hang up'));
    await expect(psaApiClient.lookupCard({ gradingNumber: '123' })).rejects.toThrow('socket hang up');
  });

  it('throws when the PSA token is not configured', async () => {
    vi.resetModules();
    const original = process.env.PSA_API_TOKEN;
    delete process.env.PSA_API_TOKEN;
    const fresh = await import('../../../src/utils/psaApiClient.js');
    await expect(fresh.psaApiClient.lookupCard({ gradingNumber: '123' }))
      .rejects.toThrow(/PSA_API_TOKEN environment variable is not set/);
    process.env.PSA_API_TOKEN = original;
    vi.resetModules();
  });
});
