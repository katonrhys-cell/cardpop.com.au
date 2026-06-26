import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

// Mutable result bag so each test controls the cache row and upsert outcome.
const h = vi.hoisted(() => ({
  cacheResult: { data: null, error: null },
  upsertResult: { error: null },
}));
const mockLookupCard = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/supabaseClient.js', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(h.cacheResult)),
    upsert: vi.fn(() => Promise.resolve(h.upsertResult)),
  };
  const supabase = { from: vi.fn(() => builder) };
  return { supabase, default: supabase };
});
vi.mock('../../../src/utils/psaApiClient.js', () => ({
  psaApiClient: { lookupCard: mockLookupCard },
  default: { lookupCard: mockLookupCard },
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { verifyGradingNumber, getCachedVerification } from '../../../src/services/gradingVerificationService.js';
import { supabase } from '../../../src/utils/supabaseClient.js';

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  h.cacheResult = { data: null, error: null };
  h.upsertResult = { error: null };
});

// ─── verifyGradingNumber: validation ───────────────────────────────────────────

describe('verifyGradingNumber — validation', () => {
  it('throws when gradingNumber is missing or not a string', async () => {
    await expect(verifyGradingNumber({ gradingNumber: '' })).rejects.toThrow(/gradingNumber is required/);
    await expect(verifyGradingNumber({ gradingNumber: 12345 })).rejects.toThrow(/gradingNumber is required/);
  });

  it('throws for an unsupported company', async () => {
    await expect(verifyGradingNumber({ gradingNumber: '123', company: 'cgc' }))
      .rejects.toThrow(/psa.*beckett/i);
  });
});

// ─── verifyGradingNumber: cache behaviour ───────────────────────────────────────

describe('verifyGradingNumber — cache', () => {
  it('returns a valid cached result without querying the PSA API', async () => {
    h.cacheResult = {
      data: {
        verified: true,
        details: { grade: 10 },
        verified_at: '2026-01-01T00:00:00Z',
        expires_at: future(),
      },
      error: null,
    };

    const result = await verifyGradingNumber({ gradingNumber: '  12345  ' });
    expect(result).toEqual({
      verified: true,
      company: 'psa',
      details: { grade: 10 },
      verifiedGrade: 10,
      gradeMatch: null,
      cached: true,
      cachedAt: '2026-01-01T00:00:00Z',
    });
    expect(mockLookupCard).not.toHaveBeenCalled();
    // The number is trimmed before the cache lookup.
    const builder = supabase.from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith('grading_number', '12345');
  });

  it('treats an expired cache entry as a miss and queries the API', async () => {
    h.cacheResult = { data: { verified: true, details: {}, expires_at: past() }, error: null };
    mockLookupCard.mockResolvedValue({ grade: 9 });

    const result = await verifyGradingNumber({ gradingNumber: '999' });
    expect(mockLookupCard).toHaveBeenCalledWith({ gradingNumber: '999' });
    expect(result.cached).toBe(false);
    expect(result.verified).toBe(true);
  });

  it('treats a cache entry without expires_at as valid', async () => {
    h.cacheResult = { data: { verified: false, details: null, verified_at: 'x' }, error: null };
    const result = await verifyGradingNumber({ gradingNumber: '111' });
    expect(result.cached).toBe(true);
    expect(mockLookupCard).not.toHaveBeenCalled();
  });
});

// ─── verifyGradingNumber: live lookup ───────────────────────────────────────────

describe('verifyGradingNumber — live lookup', () => {
  it('queries PSA, marks verified, and caches the result on a miss', async () => {
    mockLookupCard.mockResolvedValue({ grade: 10, cardName: 'Charizard' });

    const result = await verifyGradingNumber({ gradingNumber: '12345678' });
    expect(result).toEqual({
      verified: true,
      company: 'psa',
      details: { grade: 10, cardName: 'Charizard' },
      verifiedGrade: 10,
      gradeMatch: null,
      cached: false,
    });

    // Saved to cache with the right key/conflict target.
    const upsertBuilder = supabase.from.mock.results.at(-1).value;
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ grading_number: '12345678', company: 'psa', verified: true }),
      { onConflict: 'grading_number,company' },
    );
  });

  it('returns verified:false with null details when PSA has no match', async () => {
    mockLookupCard.mockResolvedValue(null);
    const result = await verifyGradingNumber({ gradingNumber: '00000' });
    expect(result.verified).toBe(false);
    expect(result.details).toBeNull();
  });

  it('rejects Beckett lookups as not implemented', async () => {
    await expect(verifyGradingNumber({ gradingNumber: '123', company: 'beckett' }))
      .rejects.toThrow(/Beckett verification not yet implemented/);
  });

  it('propagates a PSA API error', async () => {
    mockLookupCard.mockRejectedValue(new Error('PSA API timeout'));
    await expect(verifyGradingNumber({ gradingNumber: '123' })).rejects.toThrow('PSA API timeout');
  });

  it('still succeeds when caching the result fails', async () => {
    mockLookupCard.mockResolvedValue({ grade: 8 });
    h.upsertResult = { error: { message: 'write conflict' } };
    const result = await verifyGradingNumber({ gradingNumber: '777' });
    // saveToCache swallows its own error; the verification result is returned.
    expect(result.verified).toBe(true);
    expect(result.cached).toBe(false);
  });

  it('queries the API when the cache read errors (fails open to null)', async () => {
    h.cacheResult = { data: null, error: { code: 'XX000', message: 'db down' } };
    mockLookupCard.mockResolvedValue({ grade: 7 });
    const result = await verifyGradingNumber({ gradingNumber: '555' });
    // getFromCache catches the error and returns null, so a live lookup runs.
    expect(mockLookupCard).toHaveBeenCalled();
    expect(result.verified).toBe(true);
  });
});

// ─── getCachedVerification ──────────────────────────────────────────────────────

describe('getCachedVerification', () => {
  it('throws on invalid input', async () => {
    await expect(getCachedVerification({ gradingNumber: '' })).rejects.toThrow(/required/);
    await expect(getCachedVerification({ gradingNumber: '1', company: 'cgc' })).rejects.toThrow(/psa.*beckett/i);
  });

  it('returns null when nothing is cached', async () => {
    h.cacheResult = { data: null, error: null };
    expect(await getCachedVerification({ gradingNumber: '123' })).toBeNull();
    expect(mockLookupCard).not.toHaveBeenCalled();
  });

  it('returns null when the cache entry is expired', async () => {
    h.cacheResult = { data: { verified: true, details: {}, expires_at: past() }, error: null };
    expect(await getCachedVerification({ gradingNumber: '123' })).toBeNull();
  });

  it('returns the mapped result for a valid cache entry, never calling PSA', async () => {
    h.cacheResult = {
      data: { verified: true, details: { grade: 9.5 }, verified_at: '2026-02-02T00:00:00Z', expires_at: future() },
      error: null,
    };
    const result = await getCachedVerification({ gradingNumber: 'abc', company: 'beckett' });
    expect(result).toEqual({
      verified: true,
      company: 'beckett',
      details: { grade: 9.5 },
      cached: true,
      cachedAt: '2026-02-02T00:00:00Z',
    });
    expect(mockLookupCard).not.toHaveBeenCalled();
  });
});
