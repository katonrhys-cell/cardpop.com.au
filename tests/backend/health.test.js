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
