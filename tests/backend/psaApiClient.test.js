import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizePsaToken } from '../../src/utils/psaApiClient.js';

describe('normalizePsaToken', () => {
  it('strips whitespace, quotes and a pasted "Bearer " prefix', () => {
    expect(normalizePsaToken('  abc123\n')).toBe('abc123');
    expect(normalizePsaToken('"abc123"')).toBe('abc123');
    expect(normalizePsaToken("'abc123'")).toBe('abc123');
    expect(normalizePsaToken('Bearer abc123')).toBe('abc123');
    expect(normalizePsaToken(' bearer  abc123 ')).toBe('abc123');
  });

  it('leaves a clean token alone and treats a missing one as empty', () => {
    expect(normalizePsaToken('abc-123_XYZ')).toBe('abc-123_XYZ');
    expect(normalizePsaToken(undefined)).toBe('');
  });
});

describe('psaApiClient.lookupCard — refused requests', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('sends the cleaned token and puts PSA\'s reason in the error', async () => {
    vi.stubEnv('PSA_API_TOKEN', ' Bearer tok123 \n');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Daily call limit exceeded', { status: 403, statusText: 'Forbidden' })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { psaApiClient } = await import('../../src/utils/psaApiClient.js');

    await expect(psaApiClient.lookupCard({ gradingNumber: '144230642' }))
      .rejects.toThrow('PSA API error: 403 Forbidden — Daily call limit exceeded');
    expect(fetchMock).toHaveBeenCalledTimes(1); // a 403 is not retried
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('bearer tok123');
  });
});
