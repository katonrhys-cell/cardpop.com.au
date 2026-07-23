import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// sendContactMessage is the Resend send; stub it so tests never hit the network.
const mockSendContactMessage = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/emailService.js', () => ({
  sendContactMessage: mockSendContactMessage,
}));

// getContactRecipient reads platform_settings via the service-role client.
const mockIn = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: { from: () => ({ select: () => ({ in: mockIn }) }) },
}));

// Turnstile verify — default success (matches the fail-open behaviour when no
// secret is configured); individual tests override it to simulate a failure.
const mockVerifyTurnstile = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/turnstile.js', () => ({
  verifyTurnstileToken: mockVerifyTurnstile,
}));

import contactRouter from '../../src/routes/contact.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', contactRouter);
  return app;
}
const app = makeApp();

const VALID = {
  name: 'Ash Ketchum',
  email: 'ash@example.com',
  subject: 'Order question',
  message: 'I have a question about my recent order and would like some help.',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSendContactMessage.mockResolvedValue(true);
  mockIn.mockResolvedValue({ data: [{ key: 'contact_email', value: 'support@cardpop.com.au' }] });
  mockVerifyTurnstile.mockResolvedValue({ success: true });
});

// ─── validation ───────────────────────────────────────────────────────────────

describe('POST /contact — validation', () => {
  it('rejects a missing name', async () => {
    const res = await request(app).post('/').send({ ...VALID, name: 'A' });
    expect(res.status).toBe(400);
    expect(mockSendContactMessage).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/').send({ ...VALID, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(mockSendContactMessage).not.toHaveBeenCalled();
  });

  it('rejects a too-short message', async () => {
    const res = await request(app).post('/').send({ ...VALID, message: 'too short' });
    expect(res.status).toBe(400);
    expect(mockSendContactMessage).not.toHaveBeenCalled();
  });

  it('rejects an over-length field', async () => {
    const res = await request(app).post('/').send({ ...VALID, message: 'x'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(mockSendContactMessage).not.toHaveBeenCalled();
  });
});

// ─── honeypot ───────────────────────────────────────────────────────────────

describe('POST /contact — honeypot', () => {
  it('silently accepts (200) and does not send when the honeypot is filled', async () => {
    const res = await request(app).post('/').send({ ...VALID, company: 'spammer inc' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockSendContactMessage).not.toHaveBeenCalled();
  });
});

// ─── success ───────────────────────────────────────────────────────────────

describe('POST /contact — success', () => {
  it('sends to the configured contact address and returns 200', async () => {
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockSendContactMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'support@cardpop.com.au', email: 'ash@example.com', subject: 'Order question' }),
    );
  });

  it('falls back to the hard default when no platform setting is configured', async () => {
    mockIn.mockResolvedValue({ data: [] });
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(200);
    expect(mockSendContactMessage.mock.calls[0][0].to).toBe('support@cardpop.com.au');
  });

  it('prefers notification_email when no contact_email is set', async () => {
    mockIn.mockResolvedValue({ data: [{ key: 'notification_email', value: 'ops@cardpop.com.au' }] });
    await request(app).post('/').send(VALID);
    expect(mockSendContactMessage.mock.calls[0][0].to).toBe('ops@cardpop.com.au');
  });
});

// ─── captcha ───────────────────────────────────────────────────────────────

describe('POST /contact — Turnstile', () => {
  it('passes the submitted token to the verifier', async () => {
    await request(app).post('/').send({ ...VALID, turnstileToken: 'tok-123' });
    expect(mockVerifyTurnstile).toHaveBeenCalledWith('tok-123', expect.anything());
  });

  it('returns 400 and does not send when captcha verification fails', async () => {
    mockVerifyTurnstile.mockResolvedValue({ success: false });
    const res = await request(app).post('/').send({ ...VALID, turnstileToken: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/captcha/i);
    expect(mockSendContactMessage).not.toHaveBeenCalled();
  });
});

// ─── send failures ───────────────────────────────────────────────────────────

describe('POST /contact — send failures', () => {
  it('returns 502 when the email is not sent (e.g. RESEND_API_KEY unset)', async () => {
    mockSendContactMessage.mockResolvedValue(false);
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/support@cardpop\.com\.au/);
  });

  it('returns 500 when sending throws', async () => {
    mockSendContactMessage.mockRejectedValue(new Error('provider exploded'));
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(500);
  });
});
