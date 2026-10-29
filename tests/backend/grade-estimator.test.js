import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({ userId: 'user-1', files: [] }));
const mockRunGradeEstimate = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/gradeEstimator.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runGradeEstimate: mockRunGradeEstimate };
});
vi.mock('../../src/utils/compressImageBuffer.js', () => ({
  compressImageBuffer: vi.fn(async (buffer, mimetype) => ({ buffer, contentType: mimetype })),
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
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
  process.env.ANTHROPIC_API_KEY = 'test-key';
  state.userId = 'user-1';
  state.files = [{ originalname: 'card.jpg', buffer: Buffer.from('front'), mimetype: 'image/jpeg' }];
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

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

  it('returns 503 when the API key is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app).post('/estimate');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
    expect(mockRunGradeEstimate).not.toHaveBeenCalled();
  });

  it('sends the photos inline as base64 image blocks and streams the grade JSON', async () => {
    state.files = [
      { originalname: 'front.jpg', buffer: Buffer.from('front'), mimetype: 'image/jpeg' },
      { originalname: 'back.png', buffer: Buffer.from('back'), mimetype: 'image/png' },
    ];
    const reply = '{"grades":{"PSA":{"estimate":9}}}';
    mockRunGradeEstimate.mockResolvedValue({ content: reply, data: JSON.parse(reply) });

    const res = await request(app).post('/estimate');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toMatch(/no-cache/);
    expect(res.text).toContain(`data: ${JSON.stringify({ type: 'content', data: { content: reply } })}`);
    expect(res.text).toContain('"type":"completed"');

    const { apiKey, imageBlocks } = mockRunGradeEstimate.mock.calls[0][0];
    expect(apiKey).toBe('test-key');
    expect(imageBlocks).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('front').toString('base64') } },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from('back').toString('base64') } },
    ]);
  });

  it('turns a provider failure into a safe SSE error, never the raw message', async () => {
    mockRunGradeEstimate.mockRejectedValue(new Error('Anthropic API error 400: Your credit balance is too low'));

    const res = await request(app).post('/estimate');
    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toMatch(/temporarily unavailable/);
    expect(res.text).not.toMatch(/credit balance/);
  });
});

describe('gradeEstimator helpers', () => {
  it('describeGradeFailure maps timeouts and overloads to member-facing copy', async () => {
    const { describeGradeFailure } = await import('../../src/utils/gradeEstimator.js');
    expect(describeGradeFailure(new Error('The operation was aborted due to timeout'))).toMatch(/took too long/);
    expect(describeGradeFailure(new Error('Anthropic API error 529: overloaded'))).toMatch(/busy/);
    expect(describeGradeFailure(new Error('weird'))).toMatch(/could not assess/i);
  });

  it('parseGradeJson pulls the object out of surrounding prose', async () => {
    const { parseGradeJson } = await import('../../src/utils/gradeEstimator.js');
    expect(parseGradeJson('Here you go:\n{"grades":{"PSA":{"estimate":8}}}\nDone.')).toEqual({ grades: { PSA: { estimate: 8 } } });
    expect(parseGradeJson('nothing')).toBeNull();
  });

  it('buildGradePromptText tells the model when the back is missing', async () => {
    const { buildGradePromptText } = await import('../../src/utils/gradeEstimator.js');
    expect(buildGradePromptText(1)).toMatch(/only the card front/i);
    expect(buildGradePromptText(2)).toMatch(/second is the card back/i);
  });
});
