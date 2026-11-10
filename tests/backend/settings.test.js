import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the backend Supabase client before importing the router.
const mockIn = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => {
  const chain = {
    select: () => chain,
    in: (...args) => mockIn(...args),
  };
  const sb = { from: () => chain };
  return { supabase: sb, default: sb };
});

import settingsRouter, { PUBLIC_SETTINGS, coerce } from '../../src/routes/settings.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/settings', settingsRouter);
  return app;
}
const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('coerce', () => {
  it('coerces booleans from real booleans and strings', () => {
    expect(coerce(false, true)).toBe(true);
    expect(coerce(false, 'true')).toBe(true);
    expect(coerce(true, false)).toBe(false);
    expect(coerce(true, 'false')).toBe(false);
  });
  it('coerces numbers from numeric strings, falling back on garbage', () => {
    expect(coerce(10, '25')).toBe(25);
    expect(coerce(10, 25)).toBe(25);
    expect(coerce(10, 'abc')).toBe(10);
  });
  it('falls back to the default for null/undefined', () => {
    expect(coerce(10, null)).toBe(10);
    expect(coerce(false, undefined)).toBe(false);
  });
});

describe('GET /settings/public', () => {
  it('returns defaults when the table has no rows', async () => {
    mockIn.mockResolvedValue({ data: [], error: null });
    const res = await request(app).get('/settings/public');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(PUBLIC_SETTINGS);
  });

  it('merges stored overrides over the defaults, coerced to type', async () => {
    mockIn.mockResolvedValue({
      data: [
        { key: 'maintenance_mode', value: true },
        { key: 'enable_blog', value: 'false' },
        { key: 'max_images_per_listing', value: '4' },
      ],
      error: null,
    });
    const res = await request(app).get('/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.maintenance_mode).toBe(true);
    expect(res.body.enable_blog).toBe(false);
    expect(res.body.max_images_per_listing).toBe(4);
    // Untouched keys keep their defaults.
    expect(res.body.enable_marketplace).toBe(true);
  });

  it('never exposes non-whitelisted keys even if stored', async () => {
    mockIn.mockResolvedValue({
      data: [{ key: 'require_mfa_admins', value: true }, { key: 'banned_words', value: 'x' }],
      error: null,
    });
    const res = await request(app).get('/settings/public');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('require_mfa_admins');
    expect(res.body).not.toHaveProperty('banned_words');
  });

  it('fails open to defaults when the read errors', async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await request(app).get('/settings/public');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(PUBLIC_SETTINGS);
  });
});

describe('GET /public/settings (edge-cached copy)', () => {
  // Imported lazily so the router picks up the same supabaseClient mock.
  const loadPublic = async () => {
    const { default: publicRouter, publicReadCache, EDGE_CACHE_CONTROL } = await import('../../src/routes/public.js');
    const pub = express();
    pub.use('/public', publicRouter);
    return { pub, publicReadCache, EDGE_CACHE_CONTROL };
  };

  it('answers the merged settings with edge cache headers and reads the table once per TTL', async () => {
    const { pub, publicReadCache, EDGE_CACHE_CONTROL } = await loadPublic();
    publicReadCache.clear();
    const key = Object.keys(PUBLIC_SETTINGS).find((k) => typeof PUBLIC_SETTINGS[k] === 'boolean');
    mockIn.mockResolvedValue({ data: [{ key, value: !PUBLIC_SETTINGS[key] }], error: null });

    const first = await request(pub).get('/public/settings');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe(EDGE_CACHE_CONTROL);
    expect(first.body[key]).toBe(!PUBLIC_SETTINGS[key]);
    expect(Object.keys(first.body).sort()).toEqual(Object.keys(PUBLIC_SETTINGS).sort());

    await request(pub).get('/public/settings');
    expect(mockIn).toHaveBeenCalledTimes(1);
  });

  it('serves the fail-open defaults uncached when the read fails, then retries', async () => {
    const { pub, publicReadCache } = await loadPublic();
    publicReadCache.clear();
    mockIn.mockResolvedValueOnce({ data: null, error: { message: 'down' } });

    const failed = await request(pub).get('/public/settings');
    expect(failed.status).toBe(200);
    expect(failed.headers['cache-control']).toMatch(/no-store/);
    expect(failed.body).toEqual(PUBLIC_SETTINGS);

    mockIn.mockResolvedValueOnce({ data: [], error: null });
    const retried = await request(pub).get('/public/settings');
    expect(retried.headers['cache-control']).not.toMatch(/no-store/);
    expect(mockIn).toHaveBeenCalledTimes(2);
  });

  it('publishes the Google Workspace referral link and switch', () => {
    expect(PUBLIC_SETTINGS.google_workspace_referral_enabled).toBe(true);
    expect(PUBLIC_SETTINGS.google_workspace_referral_url).toMatch(/^https:\/\//);
  });
});
