import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/middleware/auth.js', () => ({
  optionalAuthMiddleware: (req, _res, next) => { if (req.headers.authorization) req.user = { id: 'u1' }; next(); },
}));

// Both branches persist to Supabase (the launch one also sends the welcome
// email); those paths are exercised in launchRegistrationService.test.js, so
// here we just stub them.
const mockRegisterLaunchInterest = vi.hoisted(() => vi.fn());
const mockRecordNewsletterSubscriber = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/launchRegistrationService.js', () => ({
  registerLaunchInterest: mockRegisterLaunchInterest,
  recordNewsletterSubscriber: mockRecordNewsletterSubscriber,
  default: mockRegisterLaunchInterest,
}));

import newsletterRouter from '../../src/routes/newsletter.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', newsletterRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// Build a minimal fetch Response-like object.
function fetchResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

const ORIGINAL_ENV = {
  KIT_API_KEY: process.env.KIT_API_KEY,
  KIT_FORM_ID: process.env.KIT_FORM_ID,
  KIT_LAUNCH_FORM_ID: process.env.KIT_LAUNCH_FORM_ID,
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KIT_API_KEY = 'kit_test_key';
  process.env.KIT_FORM_ID = 'form_123';
  delete process.env.KIT_LAUNCH_FORM_ID;
  delete process.env.RECAPTCHA_SECRET_KEY;
  global.fetch = vi.fn();
  mockRegisterLaunchInterest.mockResolvedValue({ created: true, emailed: true });
  mockRecordNewsletterSubscriber.mockResolvedValue({ created: true });
});

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// ─── validation ───────────────────────────────────────────────────────────────

describe('POST /subscribe — validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/subscribe').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid email/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when email has no @', async () => {
    const res = await request(app).post('/subscribe').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when email is not a string', async () => {
    const res = await request(app).post('/subscribe').send({ email: 12345 });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── configuration ─────────────────────────────────────────────────────────────

describe('POST /subscribe — configuration', () => {
  it('returns 503 when KIT_API_KEY is not configured', async () => {
    delete process.env.KIT_API_KEY;
    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 503 when KIT_FORM_ID is not configured', async () => {
    delete process.env.KIT_FORM_ID;
    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });
    expect(res.status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── success ────────────────────────────────────────────────────────────────────

describe('POST /subscribe — success', () => {
  it('subscribes and returns 200, calling Kit with normalized email', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: true, status: 200, body: { subscriber: {} } }));

    const res = await request(app).post('/subscribe').send({ email: '  USER@Example.COM  ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.kit.com/v4/forms/form_123/subscribers');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer kit_test_key');
    expect(JSON.parse(options.body)).toEqual({ email_address: 'user@example.com' });
  });

  it('includes first_name when provided', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    await request(app).post('/subscribe').send({ email: 'a@b.com', firstName: '  Ash  ' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ email_address: 'a@b.com', first_name: 'Ash' });
  });

  it('omits first_name when blank', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    await request(app).post('/subscribe').send({ email: 'a@b.com', firstName: '   ' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('first_name');
  });
});

// ─── launch list ────────────────────────────────────────────────────────────────

describe('POST /subscribe — launch list', () => {
  it('uses KIT_LAUNCH_FORM_ID when list is "launch" and it is configured', async () => {
    process.env.KIT_LAUNCH_FORM_ID = 'form_launch_456';
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', list: 'launch' });

    expect(res.status).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.kit.com/v4/forms/form_launch_456/subscribers');
  });

  it('falls back to KIT_FORM_ID when list is "launch" but KIT_LAUNCH_FORM_ID is unset', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', list: 'launch' });

    expect(res.status).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.kit.com/v4/forms/form_123/subscribers');
  });

  it('ignores unrecognised list values and uses the default form', async () => {
    process.env.KIT_LAUNCH_FORM_ID = 'form_launch_456';
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', list: 'something-else' });

    expect(res.status).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.kit.com/v4/forms/form_123/subscribers');
    // Non-launch lists never touch the launch registration table.
    expect(mockRegisterLaunchInterest).not.toHaveBeenCalled();
  });

  it('persists a launch signup (email + source) via registerLaunchInterest', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app)
      .post('/subscribe')
      .send({ email: 'a@b.com', list: 'launch', source: 'launch_modal' });

    expect(res.status).toBe(200);
    expect(mockRegisterLaunchInterest).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', source: 'launch_modal' }),
    );
  });

  it('still returns 200 for a launch signup when the Kit push fails (best-effort)', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: false, status: 422, body: { message: 'already subscribed' } }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', list: 'launch' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockRegisterLaunchInterest).toHaveBeenCalledTimes(1);
  });

  it('returns 500 for a launch signup when registration itself throws', async () => {
    mockRegisterLaunchInterest.mockRejectedValue(new Error('db down'));
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', list: 'launch' });

    expect(res.status).toBe(500);
  });
});

// ─── general newsletter list ──────────────────────────────────────────────────

describe('POST /subscribe — general list', () => {
  it('records the subscriber in our own table as well as pushing to Kit', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', firstName: 'Ash' });

    expect(res.status).toBe(200);
    expect(mockRecordNewsletterSubscriber).toHaveBeenCalledWith({ email: 'a@b.com', firstName: 'Ash' });
    // Never the launch path — a newsletter subscriber gets no reserved Pro
    // access and no early-access welcome email.
    expect(mockRegisterLaunchInterest).not.toHaveBeenCalled();
  });

  it('still subscribes to Kit when recording the subscriber fails (best-effort)', async () => {
    mockRecordNewsletterSubscriber.mockRejectedValue(new Error('db down'));
    global.fetch.mockResolvedValue(fetchResponse({ ok: true }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('records the subscriber even when the Kit push then fails', async () => {
    global.fetch.mockResolvedValue(fetchResponse({ ok: false, status: 422, body: { message: 'nope' } }));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });

    expect(res.status).toBe(422);
    expect(mockRecordNewsletterSubscriber).toHaveBeenCalledTimes(1);
  });
});

// ─── reCAPTCHA gate ─────────────────────────────────────────────────────────────

describe('POST /subscribe — reCAPTCHA gate', () => {
  it('rejects an anonymous request with no token once RECAPTCHA_SECRET_KEY is configured', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reCAPTCHA/i);
    // Never reaches Kit — rejected before the upstream call.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('subscribes when a valid recaptchaToken is supplied', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ ok: true, body: { success: true } })) // siteverify
      .mockResolvedValueOnce(fetchResponse({ ok: true, body: { subscriber: {} } })); // Kit

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com', recaptchaToken: 'tok' });

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('lets an authenticated caller (e.g. the signup opt-in) skip the token entirely', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue(fetchResponse({ ok: true, body: { subscriber: {} } }));

    const res = await request(app)
      .post('/subscribe')
      .set('Authorization', 'Bearer sometoken')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    // Only the Kit call — siteverify is skipped for authenticated callers.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── upstream errors ────────────────────────────────────────────────────────────

describe('POST /subscribe — upstream errors', () => {
  it('propagates the upstream status and the first Kit error message', async () => {
    global.fetch.mockResolvedValue(
      fetchResponse({ ok: false, status: 422, body: { errors: [{ message: 'Email already subscribed' }] } }),
    );

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Email already subscribed');
  });

  it('falls back to body.message when there is no errors array', async () => {
    global.fetch.mockResolvedValue(
      fetchResponse({ ok: false, status: 400, body: { message: 'Bad request' } }),
    );

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad request');
  });

  it('uses a generic message when the upstream body is unparseable', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    });

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Subscription failed.');
  });

  it('returns 500 when the fetch call itself throws', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));

    const res = await request(app).post('/subscribe').send({ email: 'a@b.com' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to connect/i);
  });
});
