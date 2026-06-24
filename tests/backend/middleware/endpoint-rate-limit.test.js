import { vi, describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  loginLimiter,
  passwordResetLimiter,
  stripeLimiter,
  mfaLimiter,
  backupCodeLimiter,
} from '../../../src/middleware/endpoint-rate-limit.js';

// Each limiter is a module singleton with its own in-memory store. Tests stay
// isolated by using a unique key per test (a unique X-Forwarded-For IP, mfaId,
// or user id) so counters never collide between tests.

function appWith(limiter, { injectUser = false } = {}) {
  const app = express();
  app.use(express.json());
  if (injectUser) {
    app.use((req, _res, next) => {
      if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'] };
      next();
    });
  }
  app.use(limiter);
  app.use((_req, res) => res.status(200).json({ ok: true }));
  return app;
}

// Fire n sequential requests, returning the array of status codes.
async function fire(app, n, decorate) {
  const codes = [];
  for (let i = 0; i < n; i++) {
    const res = await decorate(request(app).get('/login'));
    codes.push(res.status);
  }
  return codes;
}

describe('loginLimiter', () => {
  it('allows 5 attempts then returns 429 with retryAfter', async () => {
    const app = appWith(loginLimiter);
    const ip = '10.10.0.1';
    const codes = await fire(app, 5, (r) => r.set('X-Forwarded-For', ip));
    expect(codes).toEqual([200, 200, 200, 200, 200]);

    const blocked = await request(app).get('/login').set('X-Forwarded-For', ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty('retryAfter');
  });

  it('skips rate limiting for /health', async () => {
    const app = appWith(loginLimiter);
    const ip = '10.10.0.2';
    for (let i = 0; i < 8; i++) {
      const res = await request(app).get('/health').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
  });
});

describe('passwordResetLimiter', () => {
  it('blocks after 3 requests from the same IP', async () => {
    const app = appWith(passwordResetLimiter);
    const ip = '10.20.0.1';
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post('/reset').set('X-Forwarded-For', ip)).status).toBe(200);
    }
    expect((await request(app).post('/reset').set('X-Forwarded-For', ip)).status).toBe(429);
  });
});

describe('mfaLimiter — keyed by mfaId, not IP', () => {
  it('limits per mfa session so a different session is unaffected', async () => {
    const app = appWith(mfaLimiter);
    // Same mfaId from rotating IPs still hits the same bucket.
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/verify')
        .set('X-Forwarded-For', `10.30.0.${i}`)
        .send({ mfaId: 'session-A' });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post('/verify')
      .set('X-Forwarded-For', '10.30.0.99')
      .send({ mfaId: 'session-A' });
    expect(blocked.status).toBe(429);

    // A different mfa session is independent.
    const other = await request(app).post('/verify').send({ mfaId: 'session-B' });
    expect(other.status).toBe(200);
  });
});

describe('backupCodeLimiter — keyed by authenticated user', () => {
  it('limits per user id independently of other users', async () => {
    const app = appWith(backupCodeLimiter, { injectUser: true });
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/backup').set('x-test-user', 'user-A')).status).toBe(200);
    }
    expect((await request(app).post('/backup').set('x-test-user', 'user-A')).status).toBe(429);
    // Different user, fresh bucket.
    expect((await request(app).post('/backup').set('x-test-user', 'user-B')).status).toBe(200);
  });
});

describe('stripeLimiter — only applies to webhook paths', () => {
  it('does not rate limit non-webhook paths', async () => {
    const app = appWith(stripeLimiter);
    const ip = '10.40.0.1';
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/charge').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
  });
});
