import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const state = vi.hoisted(() => ({ userId: 'user-1', files: [] }));
const mockStreamGradeEstimate = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/gradeEstimator.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, streamGradeEstimate: mockStreamGradeEstimate };
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

import app from '../../api/grade-estimate.js';

const root = resolve(__dirname, '../..');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
  state.userId = 'user-1';
  state.files = [{ originalname: 'card.jpg', buffer: Buffer.from('front'), mimetype: 'image/jpeg' }];
  mockStreamGradeEstimate.mockImplementation(async ({ onText }) => {
    onText('{"grades":{"PSA":{"estimate":9}}}');
    return { content: '{"grades":{"PSA":{"estimate":9}}}', data: { grades: { PSA: { estimate: 9 } } } };
  });
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

// The dedicated 300 s function that hosts the estimator route. Vercel hands
// it the original request path, so every spelling the rewrite can produce
// must reach the handler.
describe('api/grade-estimate.js', () => {
  it.each(['/grade-estimate/estimate', '/api/grade-estimate/estimate', '/estimate'])('serves the estimate at %s', async (path) => {
    const res = await request(app).post(path);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toMatch(/no-cache|no-store/);
    expect(res.text).toContain('"type":"completed"');
  });

  it('refuses an unauthenticated caller', async () => {
    state.userId = null;
    const res = await request(app).post('/grade-estimate/estimate');
    expect(res.status).toBe(401);
    expect(mockStreamGradeEstimate).not.toHaveBeenCalled();
  });

  it('404s anything else', async () => {
    const res = await request(app).get('/grade-estimate/other');
    expect(res.status).toBe(404);
  });

  it('is wired in vercel.json: its own maxDuration, sharp bundled, and the rewrite that reaches it', () => {
    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    const fn = vercel.functions['api/grade-estimate.js'];
    expect(fn.maxDuration).toBe(300);
    expect(fn.includeFiles).toBe(vercel.functions['api/index.js'].includeFiles);
    const rewrite = vercel.rewrites.find((r) => r.source === '/grade-estimate/:path*');
    expect(rewrite).toEqual({ source: '/grade-estimate/:path*', destination: '/api/grade-estimate' });
    // It must sit before the /api catch-all would otherwise swallow it is
    // moot (different prefix), but the browser-side hook has to agree.
    const hook = readFileSync(join(root, 'hooks/useGradeEstimator.js'), 'utf8');
    expect(hook).toContain("baseUrl: '/grade-estimate'");
  });
});
