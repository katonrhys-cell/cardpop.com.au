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

    // Headers are already sent, so the failure is reported in-band over SSE —
    // as a message for the seller, not the provider's status line.
    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('Too many scans');
  });

  it('emits an SSE error event when the fetch itself rejects', async () => {
    mockFiles = oneFile();
    mockFetch.mockRejectedValue(new Error('network down'));

    const res = await request(app).post('/scan');

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"error"');
    // The underlying cause goes to the logs, not to the seller.
    expect(res.text).not.toContain('network down');
    expect(res.text).toContain('Could not read that card');
  });
});

// ─── Quality-gated escalation ─────────────────────────────────────────────────
//
// Escalation is decided on the fields the rest of the pipeline consumes, not on
// the model's opinion of its own work. A read with a name and "confidence":
// "high" but no category, set or number used to be accepted and passed straight
// into a ten-segment CardSight fan-out.

/** A read good enough that no second pass is warranted. */
const completeRead = (over = {}) => JSON.stringify({
  name: 'Charizard',
  collectionType: 'Pokemon',
  cardSetName: 'Base Set',
  cardNumber: '4/102',
  confidence: 'high',
  candidateSets: [],
  ...over,
});

describe('POST /scan — model escalation', () => {
  it('does not escalate on a complete, confident read', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk(completeRead()));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).model).toBe('claude-haiku-4-5-20251001');
  });

  it('escalates to the stronger model on low confidence and returns its result', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk(completeRead({ confidence: 'low' })))
      .mockResolvedValueOnce(anthropicOk(completeRead({ cardSetName: 'Jungle' })));

    const res = await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).model).toBe('claude-sonnet-4-6');
    expect(res.text).toContain('Jungle');
  });

  it('escalates when the fast model returns no card name', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk('{"name":null}'))
      .mockResolvedValueOnce(anthropicOk(completeRead({ name: 'Pikachu' })));

    const res = await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.text).toContain('Pikachu');
  });

  it('escalates when the category is missing', async () => {
    // collectionType picks the CardSight segment — without it, identify falls
    // back to ranking guesses from all ten segments against each other.
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk(completeRead({ collectionType: null })))
      .mockResolvedValueOnce(anthropicOk(completeRead()));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('escalates when the model shortlisted sets instead of naming one', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk(completeRead({ candidateSets: ['Base Set', 'Base Set 2'] })))
      .mockResolvedValueOnce(anthropicOk(completeRead()));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('escalates when neither a set nor a collector number was read', async () => {
    // Nothing for the catalogue lookup to corroborate a name against.
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk(completeRead({ cardSetName: null, cardNumber: null })))
      .mockResolvedValueOnce(anthropicOk(completeRead()));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('accepts a read missing only the collector number', async () => {
    // Common and tolerable — many numbers are on the back, which the auto-run
    // doesn't have. The set still gives the catalogue something to check.
    mockFiles = oneFile();
    mockFetch.mockResolvedValue(anthropicOk(completeRead({ cardNumber: null })));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('escalates when the fast reply is not parseable JSON', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk('I could not read this card.'))
      .mockResolvedValueOnce(anthropicOk(completeRead()));

    await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the fast result when the escalation reads no card', async () => {
    // A flaky or truncated second call must not replace a usable first one.
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk(completeRead({ confidence: 'low' })))
      .mockResolvedValueOnce(anthropicOk('truncated nonsense'));

    const res = await request(app).post('/scan');

    expect(res.text).toContain('Charizard');
    expect(res.text).not.toContain('truncated nonsense');
  });

  it('falls back to the fast result when escalation fails', async () => {
    mockFiles = oneFile();
    mockFetch
      .mockResolvedValueOnce(anthropicOk(completeRead({ confidence: 'low' })))
      .mockRejectedValueOnce(new Error('sonnet overloaded'));

    const res = await request(app).post('/scan');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.text).toContain('Charizard');
    expect(res.text).toContain('"type":"completed"');
    expect(res.text).not.toContain('"type":"error"');
  });
});

// ─── Provider errors must not reach the seller verbatim ───────────────────────

describe('POST /scan — failure messages', () => {
  it('does not leak account or billing state to the browser', async () => {
    // A real reply seen in production. It tells a seller nothing, and our
    // account's balance is not theirs to read.
    mockFiles = oneFile();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: { message: 'Your credit balance is too low to access the Anthropic API.' },
      }),
    });

    const res = await request(app).post('/scan');

    expect(res.text).not.toContain('credit balance');
    expect(res.text).not.toContain('Anthropic');
    expect(res.text).toContain('temporarily unavailable');
  });

  it('keeps an invalid key just as opaque', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue({
      ok: false, status: 401,
      text: async () => JSON.stringify({ error: { message: 'invalid x-api-key' } }),
    });

    const res = await request(app).post('/scan');

    expect(res.text).not.toContain('x-api-key');
    expect(res.text).toContain('temporarily unavailable');
  });

  it('tells the seller to wait when rate limited', async () => {
    mockFiles = oneFile();
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limit' });

    const res = await request(app).post('/scan');

    expect(res.text).toContain('Too many scans');
  });

  it('suggests a clearer photo when the read simply fails', async () => {
    mockFiles = oneFile();
    mockFetch.mockRejectedValue(new Error('network down'));

    const res = await request(app).post('/scan');

    expect(res.text).toContain('Could not read that card');
  });
});
