import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mutable auth state so a test can simulate an unauthenticated caller.
// supabaseAuth is optional in production (never 401s — only populates userId).
const authState = vi.hoisted(() => ({ userId: 'user-1' }));
vi.mock('../../src/middleware/supabase-auth.js', () => ({
  supabaseAuth: (req, _res, next) => { if (authState.userId) req.userId = authState.userId; next(); },
}));

vi.mock('../../src/middleware/integrated-ai-rate-limit.js', () => ({
  integratedAiRateLimit: (_req, _res, next) => next(),
}));

// The upload middleware is a spy so tests can assert it does NOT run for an
// unauthenticated request (the request body must never be buffered).
const uploadState = vi.hoisted(() => ({ files: [] }));
const uploadInner = vi.hoisted(() => vi.fn((req, _res, next) => { req.files = uploadState.files; next(); }));
vi.mock('../../src/middleware/file-upload.js', () => ({
  uploadFiles: vi.fn(() => uploadInner),
}));

const mockStream = vi.hoisted(() => vi.fn());
const mockUploadImagesToSupabase = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/integrated-ai.js', () => ({
  ContentBlockType: { Text: 'text', Image: 'image' },
  stream: mockStream,
  uploadImagesToSupabase: mockUploadImagesToSupabase,
  streamOneShot: vi.fn(),
}));

vi.mock('../../src/constants/prompts.js', () => ({
  SystemPrompt: 'mock-system-prompt',
  CardOCRPrompt: 'mock-ocr-prompt',
  EventScraperPrompt: 'mock-event-scraper-prompt',
}));

import integratedAiRouter from '../../src/routes/integrated-ai.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', integratedAiRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

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
  uploadState.files = [];
  authState.userId = 'user-1';
});

// ─── POST /stream ─────────────────────────────────────────────────────────────

describe('POST /stream', () => {
  it('returns 400 when message is missing', async () => {
    const res = await request(app).post('/stream').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message is required/i);
  });

  it('returns 400 when message is valid JSON but not an array', async () => {
    const res = await request(app).post('/stream').send({ message: '"hi"' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON array/i);
  });

  it('returns 400 when message is not valid JSON', async () => {
    const res = await request(app).post('/stream').send({ message: 'not-valid-json' });
    expect(res.status).toBe(400);
  });

  it('calls stream with the parsed message and system prompt', async () => {
    const userMessage = [{ type: 'text', text: 'Hello' }];
    mockStream.mockResolvedValue(makeSseStream());

    await request(app).post('/stream').send({ message: JSON.stringify(userMessage) });

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'mock-system-prompt',
        userMessage,
      }),
    );
  });

  it('passes userId to stream', async () => {
    const userMessage = [{ type: 'text', text: 'Hello' }];
    mockStream.mockResolvedValue(makeSseStream());

    await request(app).post('/stream').send({ message: JSON.stringify(userMessage) });

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('sets SSE response headers', async () => {
    const userMessage = [{ type: 'text', text: 'Hello' }];
    mockStream.mockResolvedValue(makeSseStream());

    const res = await request(app).post('/stream').send({ message: JSON.stringify(userMessage) });

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('appends image content blocks when files are present', async () => {
    uploadState.files = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'card.jpg' }];
    mockUploadImagesToSupabase.mockResolvedValue(['https://storage.example.com/card.jpg']);
    mockStream.mockResolvedValue(makeSseStream());

    const userMessage = [{ type: 'text', text: 'What is this card?' }];
    await request(app).post('/stream').send({ message: JSON.stringify(userMessage) });

    expect(mockUploadImagesToSupabase).toHaveBeenCalledWith({ images: uploadState.files });
    const { userMessage: sent } = mockStream.mock.calls[0][0];
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(
      expect.objectContaining({ image: 'https://storage.example.com/card.jpg' }),
    );
  });

  it('does not call uploadImagesToSupabase when no files', async () => {
    const userMessage = [{ type: 'text', text: 'Hello' }];
    mockStream.mockResolvedValue(makeSseStream());

    await request(app).post('/stream').send({ message: JSON.stringify(userMessage) });

    expect(mockUploadImagesToSupabase).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401 before the upload middleware runs', async () => {
    authState.userId = null;
    const res = await request(app)
      .post('/stream')
      .send({ message: JSON.stringify([{ type: 'text', text: 'hi' }]) });
    expect(res.status).toBe(401);
    // The body must never be buffered for an anonymous caller.
    expect(uploadInner).not.toHaveBeenCalled();
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('returns 500 when stream throws', async () => {
    mockStream.mockRejectedValue(new Error('AI service down'));

    const res = await request(app)
      .post('/stream')
      .send({ message: JSON.stringify([{ type: 'text', text: 'Hi' }]) });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/ai service down/i);
  });
});
