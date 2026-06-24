import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'node:events';

// ─── shared mutable state for middleware mocks ─────────────────────────────────

const state = vi.hoisted(() => ({ userId: 'user-1', files: [] }));
const mockStreamOneShot = vi.hoisted(() => vi.fn());
const mockUploadImages = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/integrated-ai.js', () => ({
  ContentBlockType: { Text: 'text', Image: 'image' },
  streamOneShot: mockStreamOneShot,
  uploadImagesToSupabase: mockUploadImages,
}));
vi.mock('../../src/middleware/file-upload.js', () => ({
  uploadFiles: () => (req, _res, next) => { req.files = state.files; next(); },
}));
vi.mock('../../src/middleware/integrated-ai-rate-limit.js', () => ({
  integratedAiRateLimit: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/supabase-auth.js', () => ({
  supabaseAuth: (req, _res, next) => { req.userId = state.userId; next(); },
}));

import idVerificationRouter from '../../src/routes/id-verification.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', idVerificationRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// Make streamOneShot return a fake SSE stream that emits the given events (one
// per `data:` line), then ends. The stream is created lazily when the route
// calls streamOneShot — not at mock-setup time — so emission is deferred until
// after the handler has attached its listeners.
function setStream(events, { errorAfter = false } = {}) {
  mockStreamOneShot.mockImplementation(async () => {
    const stream = new EventEmitter();
    setImmediate(() => {
      for (const ev of events) {
        stream.emit('data', Buffer.from(`data: ${JSON.stringify(ev)}\n`));
      }
      if (errorAfter) stream.emit('error', new Error('stream blew up'));
      else stream.emit('end');
    });
    return stream;
  });
}

const contentEvent = (content) => ({ type: 'content', data: { content } });

beforeEach(() => {
  vi.clearAllMocks();
  state.userId = 'user-1';
  state.files = [{ originalname: 'id.jpg', buffer: Buffer.from('x'), mimetype: 'image/jpeg' }];
  mockUploadImages.mockResolvedValue(['https://storage/id.jpg']);
});

// ─── POST /extract-name ────────────────────────────────────────────────────────

describe('POST /extract-name', () => {
  it('returns 401 when unauthenticated', async () => {
    state.userId = null;
    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('returns 400 when no image is uploaded', async () => {
    state.files = [];
    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id image is required/i);
  });

  it('extracts the name from the AI JSON response', async () => {
    const json = '{"full_name":"JOHN A SMITH","confidence":"high","document_type":"passport"}';
    setStream([contentEvent(json)]);

    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      extracted_name: 'JOHN A SMITH',
      confidence: 'high',
      document_type: 'passport',
    });
    // The uploaded image URL should be forwarded to the model.
    expect(mockUploadImages).toHaveBeenCalledTimes(1);
    expect(mockStreamOneShot).toHaveBeenCalledTimes(1);
  });

  it('reassembles a JSON response streamed across multiple chunks', async () => {
    setStream([
      contentEvent('{"full_name":"JANE'),
      contentEvent(' DOE","confidence":"medium",'),
      contentEvent('"document_type":"drivers_licence"}'),
    ]);

    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(200);
    expect(res.body.extracted_name).toBe('JANE DOE');
    expect(res.body.confidence).toBe('medium');
    expect(res.body.document_type).toBe('drivers_licence');
  });

  it('defaults missing fields to low confidence / unknown', async () => {
    setStream([contentEvent('{"full_name":"ONLY NAME"}')]);
    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      extracted_name: 'ONLY NAME',
      confidence: 'low',
      document_type: 'unknown',
    });
  });

  it('returns a null result when the model output contains no JSON', async () => {
    setStream([contentEvent('I could not read this document.')]);
    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ extracted_name: null, confidence: 'low', document_type: 'unknown' });
  });

  it('returns 500 when the stream emits an error event', async () => {
    setStream([], { errorAfter: true });
    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/name extraction failed/i);
    expect(res.body.extracted_name).toBeNull();
  });

  it('returns 500 when image upload fails', async () => {
    mockUploadImages.mockRejectedValue(new Error('storage down'));
    const res = await request(app).post('/extract-name');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/name extraction failed/i);
  });
});
