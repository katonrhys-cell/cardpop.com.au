import { vi, describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { globalRateLimit } from '../../../src/middleware/global-rate-limit.js';

// Mirrors app.js: globalRateLimit runs BEFORE the api router is mounted at
// '/', '/hcgi/api' and '/api', so req.path at this point is the full
// incoming path (e.g. '/api/health'), never the bare '/health' the router
// itself would see after the mount prefix is stripped.
function mountLikeAppJs() {
  const app = express();
  app.use(globalRateLimit);
  const apiRouter = express.Router();
  apiRouter.get('/health', (_req, res) => res.json({ ok: true }));
  apiRouter.get('/widgets', (_req, res) => res.json({ ok: true }));
  app.use('/', apiRouter);
  app.use('/hcgi/api', apiRouter);
  app.use('/api', apiRouter);
  return app;
}

describe('globalRateLimit — health-check skip must match the real mounted path', () => {
  it('never throttles /api/health, however many requests arrive', async () => {
    const app = mountLikeAppJs();
    const ip = '10.60.0.1';
    for (let i = 0; i < 60; i++) {
      const res = await request(app).get('/api/health').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
  });

  it('never throttles /hcgi/api/health either', async () => {
    const app = mountLikeAppJs();
    const ip = '10.60.0.2';
    for (let i = 0; i < 60; i++) {
      const res = await request(app).get('/hcgi/api/health').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
  });

  it('still throttles a normal endpoint after 50 requests in the window', async () => {
    const app = mountLikeAppJs();
    const ip = '10.60.0.3';
    for (let i = 0; i < 50; i++) {
      expect((await request(app).get('/api/widgets').set('X-Forwarded-For', ip)).status).toBe(200);
    }
    const blocked = await request(app).get('/api/widgets').set('X-Forwarded-For', ip);
    expect(blocked.status).toBe(429);
  });
});
