import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// Guards against the grading-verification router silently not being wired into
// routes/index.js (which sent every /grading-verification/* request to the
// catch-all 404 and broke the on-site certification badges). Hitting /verify
// with no body should reach the handler's own validation (400), not the
// app-level "Route not found" 404.
describe('grading-verification route registration', () => {
  it('is mounted (validation 400, not a catch-all 404)', async () => {
    const res = await request(app).post('/grading-verification/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe('Route not found');
  });
});

describe('request body size limit', () => {
  const bigJson = { blob: 'x'.repeat(300 * 1024) }; // ~300 KB > 256 KB default

  it('rejects an oversized JSON body with 413 on ordinary endpoints', async () => {
    const res = await request(app).post('/grading-verification/verify').send(bigJson);
    expect(res.status).toBe(413);
  });

  it('allows a larger body on the admin event-scraper paste endpoint', async () => {
    // The parser runs before routing; a 300 KB body must be accepted here (it
    // then hits auth → 401), proving it was not rejected for size.
    const res = await request(app)
      .post('/event-scraper/extract-event-from-content')
      .send({ content: 'x'.repeat(300 * 1024) });
    expect(res.status).not.toBe(413);
  });
});
