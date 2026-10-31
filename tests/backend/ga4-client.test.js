import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  parseServiceAccount, getPropertyId, isGa4Configured, buildAssertion, getAccessToken, runGa4Report, _resetTokenCache,
  SEARCH_CONSOLE_SCOPE,
} = await import('../../src/utils/ga4Client.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const keyJson = JSON.stringify({ type: 'service_account', client_email: 'ga@proj.iam.gserviceaccount.com', private_key: pem });

const saved = { json: process.env.GA4_SERVICE_ACCOUNT_JSON, prop: process.env.GA4_PROPERTY_ID };
const restore = () => {
  for (const [k, v] of [['GA4_SERVICE_ACCOUNT_JSON', saved.json], ['GA4_PROPERTY_ID', saved.prop]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
};

const b64urlDecode = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

describe('ga4Client configuration', () => {
  afterEach(restore);

  it('parses raw JSON and base64 JSON keys, unescaping newlines', () => {
    expect(parseServiceAccount(keyJson)).toMatchObject({ clientEmail: 'ga@proj.iam.gserviceaccount.com' });
    expect(parseServiceAccount(Buffer.from(keyJson).toString('base64'))).toMatchObject({ clientEmail: 'ga@proj.iam.gserviceaccount.com' });
    const escaped = JSON.stringify({ client_email: 'x@y', private_key: 'a\\nb' });
    expect(parseServiceAccount(escaped).privateKey).toBe('a\nb');
  });

  it('rejects empty, non-JSON and incomplete keys', () => {
    expect(parseServiceAccount('')).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount('not json')).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ client_email: 'x' }))).toBeNull();
  });

  it('accepts a bare or prefixed property id and nothing else', () => {
    expect(getPropertyId('123456')).toBe('123456');
    expect(getPropertyId('properties/123456')).toBe('123456');
    expect(getPropertyId('G-ABC123')).toBeNull();
    expect(getPropertyId('')).toBeNull();
  });

  it('isGa4Configured needs both env vars', () => {
    delete process.env.GA4_PROPERTY_ID; delete process.env.GA4_SERVICE_ACCOUNT_JSON;
    expect(isGa4Configured()).toBe(false);
    process.env.GA4_PROPERTY_ID = '42';
    expect(isGa4Configured()).toBe(false);
    process.env.GA4_SERVICE_ACCOUNT_JSON = keyJson;
    expect(isGa4Configured()).toBe(true);
  });
});

describe('buildAssertion', () => {
  it('produces an RS256 JWT for the analytics.readonly scope that verifies with the public key', () => {
    const jwt = buildAssertion(parseServiceAccount(keyJson), { now: 1_700_000_000_000 });
    const [h, c, sig] = jwt.split('.');
    expect(b64urlDecode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(b64urlDecode(c)).toEqual({
      iss: 'ga@proj.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    expect(ok).toBe(true);
  });
});

describe('token exchange + runReport', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    _resetTokenCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.GA4_SERVICE_ACCOUNT_JSON = keyJson;
    process.env.GA4_PROPERTY_ID = 'properties/987';
  });
  afterEach(() => { vi.unstubAllGlobals(); restore(); });

  const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

  it('exchanges the assertion once and reuses the token across reports', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, { rows: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { rows: [{}] }));

    await runGa4Report({ dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }] });
    await runGa4Report({ dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }] });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(String(tokenInit.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    const [reportUrl, reportInit] = fetchMock.mock.calls[1];
    expect(reportUrl).toBe('https://analyticsdata.googleapis.com/v1beta/properties/987:runReport');
    expect(reportInit.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(reportInit.body).dateRanges[0].startDate).toBe('7daysAgo');
  });

  it('mints a separate token per scope and caches each', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-ga4', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-gsc', expires_in: 3600 }));

    expect(await getAccessToken()).toBe('tok-ga4');
    expect(await getAccessToken({ scope: SEARCH_CONSOLE_SCOPE })).toBe('tok-gsc');
    expect(await getAccessToken()).toBe('tok-ga4');
    expect(await getAccessToken({ scope: SEARCH_CONSOLE_SCOPE })).toBe('tok-gsc');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The second assertion asked Google for the Search Console scope.
    const assertion = new URLSearchParams(String(fetchMock.mock.calls[1][1].body)).get('assertion');
    expect(b64urlDecode(assertion.split('.')[1]).scope).toBe(SEARCH_CONSOLE_SCOPE);
  });

  it('surfaces a failed token exchange', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'invalid_grant' }));
    await expect(getAccessToken()).rejects.toThrow(/token exchange failed \(400\)/);
  });

  it('surfaces a failed report without leaking the body', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(403, { error: { message: 'User does not have sufficient permissions' } }));
    await expect(runGa4Report({})).rejects.toThrow('GA4 runReport failed (403)');
  });

  it('refuses to run a report without a property id', async () => {
    delete process.env.GA4_PROPERTY_ID;
    await expect(runGa4Report({})).rejects.toThrow('GA4_PROPERTY_ID is not set');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
