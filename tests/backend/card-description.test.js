import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import process from 'node:process';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Controllable auth: tests can clear authState.userId to simulate an
// unauthenticated request (supabaseAuth passes through without setting userId)
const authState = vi.hoisted(() => ({ userId: 'user-1' }));
vi.mock('../../src/middleware/supabase-auth.js', () => {
  const middleware = (req, _res, next) => {
    if (authState.userId) req.userId = authState.userId;
    next();
  };
  return { supabaseAuth: middleware };
});

vi.mock('../../src/middleware/integrated-ai-rate-limit.js', () => ({
  integratedAiRateLimit: (_req, _res, next) => next(),
}));

vi.mock('../../src/constants/prompts.js', () => ({
  CardDescriptionPrompt: 'mock-description-prompt',
}));

import cardDescriptionRouter from '../../src/routes/card-description.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', cardDescriptionRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

const app = makeApp();
const mockFetch = vi.fn();

// A successful Anthropic Messages API response returning the given assistant text.
function anthropicOk(text) {
  return { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.userId = 'user-1';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  global.fetch = mockFetch;
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

const validCard = { cardName: 'Charizard', collection: 'Pokemon', setName: 'Base Set', cardNumber: '4/102', year: '1999' };

describe('POST /generate', () => {
  it('returns 401 when unauthenticated', async () => {
    authState.userId = null;

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 503 when the API key is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 when no card is provided', async () => {
    const res = await request(app).post('/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/card details are required/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 when the card has no name', async () => {
    const res = await request(app).post('/generate').send({ card: { setName: 'Base Set' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/card name is required/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls the Anthropic Messages API with the description system prompt', async () => {
    mockFetch.mockResolvedValue(anthropicOk('A stunning Base Set Charizard.'));

    await request(app).post('/generate').send({ card: validCard });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('mock-description-prompt');
    expect(body.messages[0].content[0].type).toBe('text');
  });

  it('includes the provided card details in the prompt and omits empty fields', async () => {
    mockFetch.mockResolvedValue(anthropicOk('desc'));

    await request(app).post('/generate').send({ card: validCard });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const promptText = body.messages[0].content[0].text;
    expect(promptText).toContain('Charizard');
    expect(promptText).toContain('Base Set');
    expect(promptText).toContain('4/102');
    // No serial number was supplied, so its label must not appear.
    expect(promptText).not.toContain('Serial number');
  });

  it('sends the API key and version headers', async () => {
    mockFetch.mockResolvedValue(anthropicOk('desc'));

    await request(app).post('/generate').send({ card: validCard });

    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBeTruthy();
  });

  it('returns the generated description as JSON', async () => {
    mockFetch.mockResolvedValue(anthropicOk('  A stunning 1999 Base Set Charizard in Near Mint condition.  '));

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('A stunning 1999 Base Set Charizard in Near Mint condition.');
  });

  it('strips surrounding quotes the model may add', async () => {
    mockFetch.mockResolvedValue(anthropicOk('"A graded gem."'));

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.body.description).toBe('A graded gem.');
  });

  it('returns 502 when Anthropic returns non-OK', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not generate/i);
  });

  it('returns 503 with a service-unavailable message when the Anthropic account is out of credit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
    });

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/temporarily unavailable/i);
  });

  it('returns 503 when Anthropic rejects the API key (401)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'authentication_error' });

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/temporarily unavailable/i);
  });

  it('returns 502 when the model returns an empty description', async () => {
    mockFetch.mockResolvedValue(anthropicOk('   '));

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/empty/i);
  });

  it('returns 502 when the fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const res = await request(app).post('/generate').send({ card: validCard });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not generate/i);
  });
});
