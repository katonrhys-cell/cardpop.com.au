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
