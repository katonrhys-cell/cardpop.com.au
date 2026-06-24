import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Readable } from 'node:stream';

const state = vi.hoisted(() => ({ userId: 'user-1', files: [] }));
const mockStreamOneShot = vi.hoisted(() => vi.fn());
const mockUploadImages = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/integrated-ai.js', () => ({
  ContentBlockType: { Text: 'text', Image: 'image' },
  streamOneShot: mockStreamOneShot,
  uploadImagesToSupabase: mockUploadImages,
}));
vi.mock('../../src/constants/prompts.js', () => ({ GradeEstimatorPrompt: 'grade-prompt' }));
vi.mock('../../src/middleware/file-upload.js', () => ({
  uploadFiles: () => (req, _res, next) => { req.files = state.files; next(); },
}));
vi.mock('../../src/middleware/integrated-ai-rate-limit.js', () => ({
  integratedAiRateLimit: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/supabase-auth.js', () => ({
  supabaseAuth: (req, _res, next) => { req.userId = state.userId; next(); },
}));

import gradeEstimatorRouter from '../../src/routes/grade-estimator.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', gradeEstimatorRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  state.userId = 'user-1';
  state.files = [{ originalname: 'card.jpg', buffer: Buffer.from('x'), mimetype: 'image/jpeg' }];
  mockUploadImages.mockResolvedValue(['https://storage/card.jpg']);
});

describe('POST /estimate', () => {
  it('returns 401 when unauthenticated', async () => {
    state.userId = null;
    const res = await request(app).post('/estimate');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('returns 400 when no image is uploaded', async () => {
    state.files = [];
    const res = await request(app).post('/estimate');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/card image is required/i);
  });

  it('uploads the images and streams the SSE grade response', async () => {
    mockStreamOneShot.mockResolvedValue(Readable.from(['data: {"psa":"9"}\n\n']));

    const res = await request(app).post('/estimate');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toMatch(/no-cache/);
    expect(res.text).toContain('"psa":"9"');

    expect(mockUploadImages).toHaveBeenCalledTimes(1);
    const callArg = mockStreamOneShot.mock.calls[0][0];
    expect(callArg.systemPrompt).toBe('grade-prompt');
    // The uploaded image URL is forwarded as an image content block.
    expect(callArg.userMessage).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image', image: 'https://storage/card.jpg' }),
    ]));
  });
});
