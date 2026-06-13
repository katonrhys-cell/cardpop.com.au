import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Controllable auth: tests can clear authState.userId to simulate an
// unauthenticated request (supabaseAuth passes through without setting userId)
const authState = vi.hoisted(() => ({ userId: 'user-1' }));
vi.mock('../../src/middleware/pocketbase-auth.js', () => {
  const middleware = (req, _res, next) => {
    if (authState.userId) req.userId = authState.userId;
    next();
  };
  return { supabaseAuth: middleware, pocketbaseAuth: middleware };
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

const mockStreamOneShot = vi.hoisted(() => vi.fn());
const mockUploadImagesToSupabase = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/integrated-ai.js', () => ({
  ContentBlockType: { Text: 'text', Image: 'image' },
  streamOneShot: mockStreamOneShot,
  uploadImagesToSupabase: mockUploadImagesToSupabase,
  stream: vi.fn(),
  uploadImagesToPocketBase: vi.fn(),
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

// Creates a fake SSE stream that ends the HTTP response immediately so supertest resolves.
function makeSseStream() {
  const emitter = new EventEmitter();
  emitter.pipe = vi.fn().mockImplementation((dest) => {
    setImmediate(() => dest.end());
    return dest;
  });
  emitter.destroy = vi.fn();
  return emitter;
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockFiles = [];
  authState.userId = 'user-1';
});

// ─── POST /scan ───────────────────────────────────────────────────────────────

describe('POST /scan', () => {
  it('returns 401 when unauthenticated', async () => {
    authState.userId = null;
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];

    const res = await request(app).post('/scan');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('does not upload images or call the AI when unauthenticated', async () => {
    authState.userId = null;
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];

    await request(app).post('/scan');

    expect(mockUploadImagesToSupabase).not.toHaveBeenCalled();
    expect(mockStreamOneShot).not.toHaveBeenCalled();
  });

  it('includes one image block per uploaded file plus the text instruction', async () => {
    mockFiles = [
      { buffer: Buffer.from('a'), mimetype: 'image/jpeg', originalname: 'front.jpg' },
      { buffer: Buffer.from('b'), mimetype: 'image/png', originalname: 'back.png' },
    ];
    mockUploadImagesToSupabase.mockResolvedValue([
      'https://storage.example.com/front.jpg',
      'https://storage.example.com/back.png',
    ]);
    mockStreamOneShot.mockResolvedValue(makeSseStream());

    await request(app).post('/scan');

    const { userMessage } = mockStreamOneShot.mock.calls[0][0];
    expect(userMessage).toHaveLength(3);
    expect(userMessage[0].type).toBe('text');
    expect(userMessage.filter(b => b.type === 'image').map(b => b.image)).toEqual([
      'https://storage.example.com/front.jpg',
      'https://storage.example.com/back.png',
    ]);
  });

  it('returns 500 when the AI stream cannot be established', async () => {
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockResolvedValue(['https://storage.example.com/card.jpg']);
    mockStreamOneShot.mockRejectedValue(new Error('AI proxy request failed with status 503'));

    const res = await request(app).post('/scan');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/503/);
  });

  it('returns 400 when no files are uploaded', async () => {
    const res = await request(app).post('/scan');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image is required/i);
  });

  it('does not call uploadImagesToSupabase when no files', async () => {
    await request(app).post('/scan');
    expect(mockUploadImagesToSupabase).not.toHaveBeenCalled();
  });

  it('calls uploadImagesToSupabase with the uploaded files', async () => {
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockResolvedValue(['https://storage.example.com/card.jpg']);
    mockStreamOneShot.mockResolvedValue(makeSseStream());

    await request(app).post('/scan');

    expect(mockUploadImagesToSupabase).toHaveBeenCalledWith({ images: mockFiles });
  });

  it('calls streamOneShot with the OCR system prompt', async () => {
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockResolvedValue(['https://storage.example.com/card.jpg']);
    mockStreamOneShot.mockResolvedValue(makeSseStream());

    await request(app).post('/scan');

    expect(mockStreamOneShot).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: 'mock-ocr-prompt' }),
    );
  });

  it('includes image content blocks in the user message', async () => {
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockResolvedValue(['https://storage.example.com/card.jpg']);
    mockStreamOneShot.mockResolvedValue(makeSseStream());

    await request(app).post('/scan');

    const { userMessage } = mockStreamOneShot.mock.calls[0][0];
    expect(userMessage).toContainEqual(
      expect.objectContaining({ type: 'image', image: 'https://storage.example.com/card.jpg' }),
    );
  });

  it('sets SSE response headers', async () => {
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockResolvedValue(['https://storage.example.com/card.jpg']);
    mockStreamOneShot.mockResolvedValue(makeSseStream());

    const res = await request(app).post('/scan');

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('returns 500 when uploadImagesToSupabase throws', async () => {
    mockFiles = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockRejectedValue(new Error('Storage unavailable'));

    const res = await request(app).post('/scan');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/storage unavailable/i);
  });
});
