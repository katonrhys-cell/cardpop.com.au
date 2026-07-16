import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/exchangeRates.js', () => ({
  convertUsdToAud: vi.fn(async (v) => v),
  getExchangeRateInfo: vi.fn(async () => ({ rate: 1 })),
}));

import { fetchPSACertification } from '../../src/utils/psaScraper.js';

afterEach(() => vi.restoreAllMocks());

describe('fetchPSACertification input validation', () => {
  it('rejects a cert number containing URL metacharacters and makes no request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '<html></html>' });
    await expect(fetchPSACertification('123/../../evil')).rejects.toThrow(/invalid certificate/i);
    await expect(fetchPSACertification('123?foo=bar')).rejects.toThrow(/invalid certificate/i);
    await expect(fetchPSACertification('123#frag')).rejects.toThrow(/invalid certificate/i);
    await expect(fetchPSACertification('123 456')).rejects.toThrow(/invalid certificate/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('builds the outbound URL from a valid alphanumeric cert number', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '<html></html>' });
    // Parsing an empty document may return null/throw — we only care that the
    // request targeted the fixed PSA host with the cert as a single path segment.
    await fetchPSACertification('138138870').catch(() => {});
    expect(fetchSpy).toHaveBeenCalledWith('https://www.psacard.com/cert/138138870', expect.any(Object));
  });
});
