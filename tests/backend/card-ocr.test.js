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

let mockFiles = [];
vi.mock('../../src/middleware/file-upload.js', () => ({
  uploadFiles: vi.fn().mockImplementation(() => (req, _res, next) => {
    req.files = mockFiles;
    next();
  }),
}));

vi.mock('../../src/constants/prompts.js', () => ({
  CardOCRPrompt: 'mock-ocr-prompt',
  SystemPrompt: 'mock-system-prompt',
  EventScraperPrompt: 'mock-event-scraper-prompt',
}));

import cardOcrRouter from '../../src/routes/card-ocr.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', cardOcrRouter);
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
  mockFiles = [];
  authState.userId = 'user-1';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  global.fetch = mockFetch;
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

const oneFile = () => [{ buffer: Buffer.from('img-bytes'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];

// ─── POST /scan ───────────────────────────────────────────────────────────────

describe('POST /scan', () => {
  it('returns 401 when unauthenticated', async () => {
    authState.userId = null;
    mockFiles = oneFile();

    const res = await request(app).post('/scan');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('does not call the AI when unauthenticated', async () => {
    authState.userId = null;
    mockFiles = oneFile();

    await request(app).post('/scan');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 when no files are uploaded', async () => {
    const res = await request(app).post('/scan');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image is required/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 503 when the API key is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockFiles = oneFile();

    const res = await request(app).post('/scan');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls the Anthropic Messages API with the OCR system prompt', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk('{"name":"Charizard"}'));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('mock-ocr-prompt');
  });

  it('sends the API key and version headers', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk('{}'));

    await request(app).post('/scan');

    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBeTruthy();
  });

  it('includes one base64 image block per uploaded file plus the text instruction', async () => {
    mockFiles = [
      { buffer: Buffer.from('a'), mimetype: 'image/jpeg', originalname: 'front.jpg' },
      { buffer: Buffer.from('b'), mimetype: 'image/png', originalname: 'back.png' },
    ];
    mockFetch.mockResolvedValue(anthropicOk('{}'));

    await request(app).post('/scan');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const content = body.messages[0].content;
    expect(content[0].type).toBe('text');
    const images = content.filter(b => b.type === 'image');
    expect(images).toHaveLength(2);
    expect(images[0].source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: Buffer.from('a').toString('base64'),
    });
    expect(images[1].source.media_type).toBe('image/png');
  });

  it('sets SSE response headers', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk('{"name":"Pikachu"}'));

    const res = await request(app).post('/scan');

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('streams the assistant content followed by a completed event', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk('{"name":"Charizard"}'));

    const res = await request(app).post('/scan');

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"content"');
    expect(res.text).toContain('Charizard');
    expect(res.text).toContain('"type":"completed"');
  });

  it('emits an SSE error event (not an HTTP error) when Anthropic returns non-OK', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });

    const res = await request(app).post('/scan');

    // Headers are already sent, so the failure is reported in-band over SSE.
    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('429');
  });

  it('emits an SSE error event when the fetch itself rejects', async () => {
    mockFiles = oneFile();
    mockFetch.mockRejectedValue(new Error('network down'));

    const res = await request(app).post('/scan');

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('network down');
  });
});

// ─── Confidence-gated escalation ───────────────────────────────────────────────

describe('POST /scan — model escalation', () => {
  it('does not escalate when the fast model is confident', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk('{"name":"Charizard","confidence":"high"}'));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).model).toBe('claude-haiku-4-5-20251001');
  });

  it('escalates to the stronger model on low confidence and returns its result', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk('{"name":"Charizard","confidence":"low"}'))
      .mockResolvedValueOnce(anthropicOk('{"name":"Charizard","cardSetName":"Base Set","confidence":"high"}'));

    const res = await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).model).toBe('claude-sonnet-4-6');
    expect(res.text).toContain('Base Set');
  });

  it('escalates when the fast model returns no card name', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk('{"name":null}'))
      .mockResolvedValueOnce(anthropicOk('{"name":"Pikachu","confidence":"high"}'));

    const res = await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.text).toContain('Pikachu');
  });

  it('falls back to the fast result when escalation fails', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk('{"name":"Charizard","confidence":"low"}'))
      .mockRejectedValueOnce(new Error('sonnet overloaded'));

    const res = await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.text).toContain('Charizard');
    expect(res.text).toContain('"type":"completed"');
    expect(res.text).not.toContain('"type":"error"');
  });
});
