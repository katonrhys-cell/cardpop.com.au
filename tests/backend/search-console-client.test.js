import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ga4 = vi.hoisted(() => ({ token: vi.fn(), account: { clientEmail: 'sa@proj.iam.gserviceaccount.com' } }));
vi.mock('../../src/utils/ga4Client.js', () => ({
  getAccessToken: ga4.token,
  parseServiceAccount: () => ga4.account,
  SEARCH_CONSOLE_SCOPE: 'https://www.googleapis.com/auth/webmasters.readonly',
}));

const { getSiteUrl, isSearchConsoleConfigured, runSearchAnalytics } = await import('../../src/utils/searchConsoleClient.js');

const savedSite = process.env.GSC_SITE_URL;
const restore = () => {
  if (savedSite === undefined) delete process.env.GSC_SITE_URL; else process.env.GSC_SITE_URL = savedSite;
};

describe('searchConsoleClient configuration', () => {
  afterEach(restore);

  it('accepts a Domain property or a URL-prefix property and nothing else', () => {
    expect(getSiteUrl('sc-domain:cardpop.com.au')).toBe('sc-domain:cardpop.com.au');
    expect(getSiteUrl('  https://cardpop.com.au  ')).toBe('https://cardpop.com.au/');
    expect(getSiteUrl('https://cardpop.com.au/')).toBe('https://cardpop.com.au/');
    expect(getSiteUrl('cardpop.com.au')).toBeNull();
    expect(getSiteUrl('')).toBeNull();
    expect(getSiteUrl(undefined)).toBeNull();
  });

  it('isSearchConsoleConfigured needs the site url and the shared service account', () => {
    delete process.env.GSC_SITE_URL;
    expect(isSearchConsoleConfigured()).toBe(false);
    process.env.GSC_SITE_URL = 'sc-domain:cardpop.com.au';
    expect(isSearchConsoleConfigured()).toBe(true);
    ga4.account = null;
    expect(isSearchConsoleConfigured()).toBe(false);
    ga4.account = { clientEmail: 'sa@proj.iam.gserviceaccount.com' };
  });
});

describe('runSearchAnalytics', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.GSC_SITE_URL = 'sc-domain:cardpop.com.au';
    ga4.token.mockReset().mockResolvedValue('tok-gsc');
    global.fetch = vi.fn();
  });
  afterEach(() => { global.fetch = originalFetch; restore(); });

  it('posts the query to the encoded property with a Search Console token and a timeout', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ rows: [{ keys: ['2026-10-01'], clicks: 3, impressions: 90 }] }) });
    const body = { startDate: '2026-09-01', endDate: '2026-10-01', dimensions: ['date'] };
    const res = await runSearchAnalytics(body);
    expect(res.rows).toHaveLength(1);
    expect(ga4.token).toHaveBeenCalledWith({ scope: 'https://www.googleapis.com/auth/webmasters.readonly' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Acardpop.com.au/searchAnalytics/query');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-gsc');
    expect(JSON.parse(init.body)).toEqual(body);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws without a site url and never fetches', async () => {
    delete process.env.GSC_SITE_URL;
    await expect(runSearchAnalytics({})).rejects.toThrow(/GSC_SITE_URL/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces a non-2xx answer with the status', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' });
    await expect(runSearchAnalytics({})).rejects.toThrow(/403/);
  });
});
