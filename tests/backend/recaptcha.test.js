import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { verifyRecaptchaToken } from '../../src/utils/recaptcha.js';

function fetchResponse(body = {}, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

const ORIGINAL_SECRET = process.env.RECAPTCHA_SECRET_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  delete process.env.RECAPTCHA_SECRET_KEY;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
  else process.env.RECAPTCHA_SECRET_KEY = ORIGINAL_SECRET;
});

describe('verifyRecaptchaToken', () => {
  it('fails open (skipped) when the secret is not configured', async () => {
    const result = await verifyRecaptchaToken('anything');
    expect(result).toEqual({ success: true, skipped: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing token when the secret is configured', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    const result = await verifyRecaptchaToken('');
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('missing-input-response');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns success when Google confirms the token', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue(fetchResponse({ success: true, hostname: 'cardpop.online' }));
    const result = await verifyRecaptchaToken('good-token', '1.2.3.4');

    expect(result.success).toBe(true);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://www.google.com/recaptcha/api/siteverify');
    expect(options.body).toContain('secret=secret');
    expect(options.body).toContain('response=good-token');
    expect(options.body).toContain('remoteip=1.2.3.4');
  });

  it('returns failure when Google rejects the token', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue(fetchResponse({ success: false, 'error-codes': ['invalid-input-response'] }));
    const result = await verifyRecaptchaToken('bad-token');
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('invalid-input-response');
  });

  it('fails closed when the siteverify request throws', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await verifyRecaptchaToken('token');
    expect(result.success).toBe(false);
  });
});
