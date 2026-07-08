import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockVerify = vi.hoisted(() => vi.fn());
const mockGetCached = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/gradingVerificationService.js', () => ({
  verifyGradingNumber: mockVerify,
  getCachedVerification: mockGetCached,
}));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import gradingVerificationRouter from '../../src/routes/grading-verification.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', gradingVerificationRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

beforeEach(() => vi.clearAllMocks());

// ─── POST /verify ──────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('returns 400 when gradingNumber is missing', async () => {
    const res = await request(app).post('/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gradingNumber is required/i);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns 400 when gradingNumber is not a string', async () => {
    const res = await request(app).post('/verify').send({ gradingNumber: 12345 });
    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns 400 when gradingNumber is whitespace only', async () => {
    const res = await request(app).post('/verify').send({ gradingNumber: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unsupported company', async () => {
    const res = await request(app).post('/verify').send({ gradingNumber: '123', company: 'cgc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/psa.*beckett/i);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('defaults to PSA and returns the verification result', async () => {
    const result = { verified: true, company: 'psa', details: { grade: 10 }, cached: false };
    mockVerify.mockResolvedValue(result);

    const res = await request(app).post('/verify').send({ gradingNumber: ' 12345678 ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({ gradingNumber: ' 12345678 ', company: 'psa' }));
  });

  it('passes the beckett company through to the service', async () => {
    mockVerify.mockResolvedValue({ verified: false, company: 'beckett', details: null, cached: true });
    const res = await request(app).post('/verify').send({ gradingNumber: 'B-1', company: 'beckett' });
    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({ gradingNumber: 'B-1', company: 'beckett' }));
  });

  it('threads the claimed grade through as expectedGrade', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: false, cached: false });
    const res = await request(app).post('/verify').send({ gradingNumber: '123', expectedGrade: 'PSA 10' });
    expect(res.status).toBe(200);
    expect(res.body.gradeMatch).toBe(false);
    expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({ expectedGrade: 'PSA 10' }));
  });

  it('rejects a non-string expectedGrade', async () => {
    const res = await request(app).post('/verify').send({ gradingNumber: '123', expectedGrade: 10 });
    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns 503 (not 400) when the live lookup fails with no cache to fall back on', async () => {
    mockVerify.mockRejectedValue(new Error('PSA API unavailable'));
    const res = await request(app).post('/verify').send({ gradingNumber: '123' });
    expect(res.status).toBe(503);
    // Generic client-facing message; the real error stays in the server logs.
    expect(res.body.error).toMatch(/try again shortly/i);
  });

  it('returns 501 for a not-yet-implemented company', async () => {
    mockVerify.mockRejectedValue(new Error('Beckett verification not yet implemented'));
    const res = await request(app).post('/verify').send({ gradingNumber: '123' });
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/not yet implemented/i);
  });
});

// ─── GET /:gradingNumber ───────────────────────────────────────────────────────

describe('GET /:gradingNumber', () => {
  it('returns 400 for an unsupported company', async () => {
    const res = await request(app).get('/123').query({ company: 'cgc' });
    expect(res.status).toBe(400);
    expect(mockGetCached).not.toHaveBeenCalled();
  });

  it('returns 400 when the gradingNumber is whitespace only', async () => {
    const res = await request(app).get('/%20%20');
    expect(res.status).toBe(400);
  });

  it('returns 404 when there is no cached verification', async () => {
    mockGetCached.mockResolvedValue(null);
    const res = await request(app).get('/123');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no cached verification/i);
    expect(mockGetCached).toHaveBeenCalledWith({ gradingNumber: '123', company: 'psa' });
  });

  it('returns the mapped cached result', async () => {
    mockGetCached.mockResolvedValue({
      verified: true,
      company: 'beckett',
      details: { grade: 9.5 },
      cachedAt: '2026-01-01T00:00:00Z',
    });

    const res = await request(app).get('/B-9').query({ company: 'beckett' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      verified: true,
      company: 'beckett',
      details: { grade: 9.5 },
      verified_at: '2026-01-01T00:00:00Z',
    });
    expect(mockGetCached).toHaveBeenCalledWith({ gradingNumber: 'B-9', company: 'beckett' });
  });

  it('returns 500 when the cache lookup throws', async () => {
    mockGetCached.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/123');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db down');
  });
});
