import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

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

const ORIGINAL_ENV = { KIT_API_KEY: process.env.KIT_API_KEY, KIT_FORM_ID: process.env.KIT_FORM_ID };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KIT_API_KEY = 'kit_test_key';
  process.env.KIT_FORM_ID = 'form_123';
  global.fetch = vi.fn();
});

afterEach(() => {
  process.env.KIT_API_KEY = ORIGINAL_ENV.KIT_API_KEY;
  process.env.KIT_FORM_ID = ORIGINAL_ENV.KIT_FORM_ID;
  if (ORIGINAL_ENV.KIT_API_KEY === undefined) delete process.env.KIT_API_KEY;
  if (ORIGINAL_ENV.KIT_FORM_ID === undefined) delete process.env.KIT_FORM_ID;
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
