import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// The per-instance caches that take a network round-trip off most API
// requests: token verification, the admin flag, MFA factors, platform
// settings. The backend setup disables them; these tests switch each on.

const mockGetUser = vi.hoisted(() => vi.fn());
const mockListFactors = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/supabaseClient.js', () => {
  const supabase = { auth: { getUser: mockGetUser, admin: { mfa: { listFactors: mockListFactors } } }, from: mockFrom };
  return { default: supabase, supabase };
});
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createTtlCache } from '../../../src/utils/ttlCache.js';
import { getUserForToken, clearAuthTokenCache, msUntilExpiry } from '../../../src/utils/authTokenCache.js';
import { getPlatformSetting, getPlatformSettings, invalidatePlatformSettings } from '../../../src/utils/platformSettings.js';
import { isAdminUser } from '../../../src/middleware/auth.js';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const jwt = (claims) => `h.${b64url(claims)}.sig`;

const savedEnv = {};
const setEnv = (pairs) => {
  for (const [k, v] of Object.entries(pairs)) { savedEnv[k] = process.env[k]; process.env[k] = v; }
};
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  for (const k of Object.keys(savedEnv)) delete savedEnv[k];
  clearAuthTokenCache();
  invalidatePlatformSettings();
});
beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe('createTtlCache', () => {
  it('is a pass-through when the TTL is 0', async () => {
    const c = createTtlCache({ ttlMs: 0 });
    const loader = vi.fn(async () => 'v');
    expect(await c.get('k', loader)).toBe('v');
    expect(await c.get('k', loader)).toBe('v');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(c.enabled()).toBe(false);
  });

  it('caches within the TTL, de-dupes concurrent loads and expires', async () => {
    vi.useFakeTimers();
    const c = createTtlCache({ ttlMs: () => 1000 });
    const loader = vi.fn(async () => 'v');
    const [a, b] = await Promise.all([c.get('k', loader), c.get('k', loader)]);
    expect(a).toBe('v'); expect(b).toBe('v');
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    await c.get('k', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2);
    await c.get('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('caps an entry at maxTtlMs and never caches undefined', async () => {
    vi.useFakeTimers();
    const c = createTtlCache({ ttlMs: 60_000 });
    const loader = vi.fn(async () => 'v');
    await c.get('k', loader, { maxTtlMs: 100 });
    vi.advanceTimersByTime(150);
    await c.get('k', loader, { maxTtlMs: 100 });
    expect(loader).toHaveBeenCalledTimes(2);
    const nothing = vi.fn(async () => undefined);
    await c.get('n', nothing); await c.get('n', nothing);
    expect(nothing).toHaveBeenCalledTimes(2);
  });
});

describe('getUserForToken', () => {
  it('verifies once per token within the window and keys on a hash, not the token', async () => {
    setEnv({ AUTH_TOKEN_CACHE_TTL_MS: '60000', AUTH_TOKEN_NEGATIVE_TTL_MS: '5000' });
    const user = { id: 'u1' };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    const token = jwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
    const first = await getUserForToken(token);
    const second = await getUserForToken(token);
    expect(first.data.user).toEqual(user);
    expect(second.data.user).toEqual(user);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith(token);
  });

  it('never caches past the token’s own expiry', async () => {
    vi.useFakeTimers();
    setEnv({ AUTH_TOKEN_CACHE_TTL_MS: '60000' });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const token = jwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 2 }); // expires in 2 s
    expect(msUntilExpiry(token)).toBeLessThanOrEqual(2000);
    await getUserForToken(token);
    vi.advanceTimersByTime(2500);
    await getUserForToken(token);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  it('remembers an invalid token briefly instead of re-asking GoTrue', async () => {
    setEnv({ AUTH_TOKEN_CACHE_TTL_MS: '60000', AUTH_TOKEN_NEGATIVE_TTL_MS: '5000' });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } });
    const r1 = await getUserForToken('bad');
    const r2 = await getUserForToken('bad');
    expect(r1.error.message).toBe('JWT expired');
    expect(r2.data.user).toBeNull();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('is a pass-through with the TTL at 0 (the test default)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await getUserForToken('t'); await getUserForToken('t');
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });
});

describe('isAdminUser', () => {
  const builder = (row) => {
    const b = { select: vi.fn(() => b), eq: vi.fn(() => b), maybeSingle: vi.fn(async () => ({ data: row, error: null })) };
    return b;
  };

  it('memoises the verdict on the request and caches it per user', async () => {
    setEnv({ ADMIN_FLAG_CACHE_TTL_MS: '30000' });
    mockFrom.mockImplementation(() => builder({ is_admin: true }));
    const req = { user: { id: 'u1' } };
    expect(await isAdminUser(req)).toBe(true);
    expect(await isAdminUser(req)).toBe(true);
    expect(await isAdminUser({ user: { id: 'u1' } })).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed read', async () => {
    setEnv({ ADMIN_FLAG_CACHE_TTL_MS: '30000' });
    const failing = { select: vi.fn(function () { return this; }), eq: vi.fn(function () { return this; }), maybeSingle: vi.fn(async () => ({ data: null, error: { message: 'down' } })) };
    mockFrom.mockReturnValueOnce(failing).mockReturnValueOnce(builder({ is_admin: true }));
    expect(await isAdminUser({ user: { id: 'u2' } })).toBe(false);
    expect(await isAdminUser({ user: { id: 'u2' } })).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});

describe('platform settings', () => {
  const single = (value) => {
    const b = { select: vi.fn(() => b), eq: vi.fn(() => b), maybeSingle: vi.fn(async () => ({ data: value === undefined ? null : { value }, error: null })) };
    return b;
  };

  it('reads a key once per window and returns the default for a missing row', async () => {
    setEnv({ PLATFORM_SETTINGS_TTL_MS: '30000' });
    mockFrom.mockReturnValueOnce(single(10)).mockReturnValueOnce(single(undefined));
    expect(await getPlatformSetting('gst_rate_pct', 7)).toBe(10);
    expect(await getPlatformSetting('gst_rate_pct', 7)).toBe(10);
    expect(await getPlatformSetting('nope', 'dflt')).toBe('dflt');
    expect(await getPlatformSetting('nope', 'dflt')).toBe('dflt'); // the miss is cached too
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('batches several keys into one query and skips the ones already cached', async () => {
    setEnv({ PLATFORM_SETTINGS_TTL_MS: '30000' });
    mockFrom.mockReturnValueOnce(single(true));
    await getPlatformSetting('gst_enabled', false);
    const batch = { select: vi.fn(() => batch), in: vi.fn(async () => ({ data: [{ key: 'gst_rate_pct', value: 10 }], error: null })) };
    mockFrom.mockReturnValueOnce(batch);
    const out = await getPlatformSettings(['gst_enabled', 'gst_rate_pct', 'processing_fee_pct']);
    expect(batch.in).toHaveBeenCalledWith('key', ['gst_rate_pct', 'processing_fee_pct']);
    expect(out).toEqual({ gst_enabled: true, gst_rate_pct: 10 });
    // Everything from the batch is now cached, including the miss.
    expect(await getPlatformSetting('processing_fee_pct', 1.9)).toBe(1.9);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces a re-read', async () => {
    setEnv({ PLATFORM_SETTINGS_TTL_MS: '30000' });
    mockFrom.mockReturnValueOnce(single(1)).mockReturnValueOnce(single(2));
    expect(await getPlatformSetting('k', 0)).toBe(1);
    invalidatePlatformSettings('k');
    expect(await getPlatformSetting('k', 0)).toBe(2);
  });
});
