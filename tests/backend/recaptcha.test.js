import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

import recaptchaRouter from '../../src/routes/recaptcha.js';
import { verifyRecaptchaToken } from '../../src/utils/recaptcha.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/recaptcha', recaptchaRouter);
  return app;
}
const app = makeApp();

function fetchResponse(body = {}, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

const ORIGINAL = {
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  KIT_API_KEY: process.env.KIT_API_KEY,
  KIT_FORM_ID: process.env.KIT_FORM_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  delete process.env.RECAPTCHA_SECRET_KEY;
});

afterEach(() => {
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// ─── verifyRecaptchaToken util ──────────────────────────────────────────────

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

// ─── POST /recaptcha/verify ─────────────────────────────────────────────────

describe('POST /recaptcha/verify', () => {
  it('returns 200 when verification is skipped (no secret configured)', async () => {
    const res = await request(app).post('/recaptcha/verify').send({ token: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 400 when Google rejects the token', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue(fetchResponse({ success: false }));
    const res = await request(app).post('/recaptcha/verify').send({ token: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reCAPTCHA/i);
  });

  it('subscribes to the newsletter (best-effort) when opted in and verified', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    process.env.KIT_API_KEY = 'kit_key';
    process.env.KIT_FORM_ID = 'form_1';

    global.fetch.mockImplementation((url) => {
      if (url.includes('siteverify')) return Promise.resolve(fetchResponse({ success: true }));
      return Promise.resolve(fetchResponse({ subscriber: {} }));
    });

    const res = await request(app)
      .post('/recaptcha/verify')
      .send({ token: 'good', newsletter: { email: 'a@b.com', firstName: 'Ash' } });

    expect(res.status).toBe(200);
    const kitCall = global.fetch.mock.calls.find(([u]) => u.includes('api.kit.com'));
    expect(kitCall).toBeDefined();
    expect(JSON.parse(kitCall[1].body)).toEqual({ email_address: 'a@b.com', first_name: 'Ash' });
  });

  it('still succeeds if the newsletter opt-in fails', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    process.env.KIT_API_KEY = 'kit_key';
    process.env.KIT_FORM_ID = 'form_1';

    global.fetch.mockImplementation((url) => {
      if (url.includes('siteverify')) return Promise.resolve(fetchResponse({ success: true }));
      return Promise.reject(new Error('kit down'));
    });

    const res = await request(app)
      .post('/recaptcha/verify')
      .send({ token: 'good', newsletter: { email: 'a@b.com' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});
