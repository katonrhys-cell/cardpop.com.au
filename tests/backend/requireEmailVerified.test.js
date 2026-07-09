import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetPlatformSetting = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/stripeWebhookService.js', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

import { requireEmailVerified } from '../../src/middleware/requireEmailVerified.js';

function run(user, settingValue) {
  mockGetPlatformSetting.mockResolvedValue(settingValue);
  const req = { user, method: 'POST', originalUrl: '/api/stripe/create-cart-checkout' };
  let statusCode = null;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  const next = vi.fn();
  return requireEmailVerified(req, res, next).then(() => ({ statusCode, jsonBody, next }));
}

beforeEach(() => vi.clearAllMocks());

describe('requireEmailVerified', () => {
  it('passes through when the flag is off, regardless of verification', async () => {
    const { next, statusCode } = await run({ id: 'u1', email_confirmed_at: null }, false);
    expect(next).toHaveBeenCalled();
    expect(statusCode).toBeNull();
  });

  it('passes a verified user when the flag is on', async () => {
    const { next, statusCode } = await run({ id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' }, true);
    expect(next).toHaveBeenCalled();
    expect(statusCode).toBeNull();
  });

  it('blocks an unverified user with 403 when the flag is on', async () => {
    const { next, statusCode, jsonBody } = await run({ id: 'u1', email_confirmed_at: null }, true);
    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(403);
    expect(jsonBody.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('treats the string "true" as on', async () => {
    const { statusCode } = await run({ id: 'u1', email_confirmed_at: null }, 'true');
    expect(statusCode).toBe(403);
  });

  it('401s when unauthenticated', async () => {
    const { statusCode } = await run(undefined, true);
    expect(statusCode).toBe(401);
  });

  it('fails open (passes) when the settings read throws', async () => {
    mockGetPlatformSetting.mockRejectedValue(new Error('db down'));
    const req = { user: { id: 'u1', email_confirmed_at: null }, method: 'POST', originalUrl: '/x' };
    const next = vi.fn();
    await requireEmailVerified(req, { status: () => ({ json: () => {} }) }, next);
    expect(next).toHaveBeenCalled();
  });
});
