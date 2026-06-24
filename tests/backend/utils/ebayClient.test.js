import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The client memoizes its OAuth token at module scope, so reset the module
// registry per test to start from a clean (un-cached) state.
async function load() {
  vi.resetModules();
  return import('../../../src/utils/ebayClient.js');
}

function res({ ok = true, status = 200, statusText = 'OK', json = {}, text = '' } = {}) {
  return {
    ok, status, statusText,
    json: vi.fn().mockResolvedValue(json),
    text: vi.fn().mockResolvedValue(text),
  };
}
const tokenRes = (expires = 7200) => res({ json: { access_token: 'tok-123', expires_in: expires } });

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('getAccessToken', () => {
  it('requests an OAuth2 client-credentials token and returns it', async () => {
    global.fetch.mockResolvedValue(tokenRes());
    const { getAccessToken } = await load();
    const token = await getAccessToken();

    expect(token).toBe('tok-123');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/identity/v1/oauth2/token');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toMatch(/^Basic /);
    expect(options.body).toContain('grant_type=client_credentials');
  });

  it('caches the token and does not re-request within its lifetime', async () => {
    global.fetch.mockResolvedValue(tokenRes());
    const { getAccessToken } = await load();
    await getAccessToken();
    await getAccessToken();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the OAuth2 request fails', async () => {
    global.fetch.mockResolvedValue(res({ ok: false, status: 401, statusText: 'Unauthorized', text: 'bad creds' }));
    const { getAccessToken } = await load();
    await expect(getAccessToken()).rejects.toThrow(/eBay OAuth2 failed: 401/);
  });

  it('throws when credentials are not configured', async () => {
    const origId = process.env.EBAY_APP_ID;
    delete process.env.EBAY_APP_ID;
    const { getAccessToken } = await load();
    await expect(getAccessToken()).rejects.toThrow(/credentials not configured/);
    process.env.EBAY_APP_ID = origId;
  });
});

describe('callEbayApi', () => {
  it('attaches the bearer token and AU marketplace header, returning JSON', async () => {
    global.fetch
      .mockResolvedValueOnce(tokenRes())                       // token request
      .mockResolvedValueOnce(res({ json: { itemSummaries: [] } })); // API request

    const { callEbayApi } = await load();
    const data = await callEbayApi('/buy/browse/v1/item_summary/search?q=charizard');

    expect(data).toEqual({ itemSummaries: [] });
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toContain('/buy/browse/v1/item_summary/search');
    expect(options.headers.Authorization).toBe('Bearer tok-123');
    expect(options.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_AU');
  });

  it('surfaces the first eBay error message from a JSON error body', async () => {
    global.fetch
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res({
        ok: false, status: 400, statusText: 'Bad Request',
        text: JSON.stringify({ errors: [{ message: 'Invalid query parameter' }] }),
      }));

    const { callEbayApi } = await load();
    await expect(callEbayApi('/x')).rejects.toThrow('Invalid query parameter');
  });

  it('falls back to a generic message for a non-JSON error body', async () => {
    global.fetch
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res({ ok: false, status: 503, statusText: 'Service Unavailable', text: '<html>down</html>' }));

    const { callEbayApi } = await load();
    await expect(callEbayApi('/x')).rejects.toThrow(/eBay API error: 503 Service Unavailable/);
  });

  it('propagates a network failure', async () => {
    global.fetch
      .mockResolvedValueOnce(tokenRes())
      .mockRejectedValueOnce(new Error('ECONNRESET'));

    const { callEbayApi } = await load();
    await expect(callEbayApi('/x')).rejects.toThrow('ECONNRESET');
  });
});
