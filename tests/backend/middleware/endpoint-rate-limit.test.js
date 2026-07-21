import { vi, describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The security-sensitive limiters use the Postgres-backed shared store
// (PgRateLimitStore → supabase.rpc('rate_limit_hit')). Simulate that RPC with an
// in-memory counter so the limiters trip exactly as they would against the real
// atomic counter. Tests use a unique key (IP/user) per test, so counters never
// collide between tests.
const rlHits = vi.hoisted(() => new Map());
vi.mock('../../../src/utils/supabaseClient.js', () => ({
  default: {},
  supabase: {
    rpc: async (fn, args) => {
      if (fn === 'rate_limit_hit') {
        const n = (rlHits.get(args.p_key) || 0) + 1;
        rlHits.set(args.p_key, n);
        return { data: [{ total_hits: n, reset_at: new Date(Date.now() + Number(args.p_window_ms)).toISOString() }], error: null };
      }
      if (fn === 'rate_limit_reset') { rlHits.delete(args.p_key); return { data: null, error: null }; }
      return { data: null, error: null };
    },
  },
}));

import {
  loginLimiter,
  passwordResetLimiter,
  stripeLimiter,
  apiLimiter,
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

describe('stripeLimiter — applies uniformly wherever mounted (no internal path filtering)', () => {
  // stripeLimiter used to carry its own `skip` based on req.path, but req.path
  // is relative to the mount point — a request to exactly '/stripe/webhook'
  // saw req.path === '/' inside a middleware mounted at '/stripe/webhook',
  // making the skip condition always true and this limiter permanently dead.
  // Scoping now happens entirely via WHERE it's mounted (routes/index.js
  // mounts it only at the exact webhook paths), not via a path check here.
  it('counts every request it sees toward its own 1000/min cap, regardless of path', async () => {
    const app = appWith(stripeLimiter);
    const ip = '10.40.0.1';
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/charge').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200); // well under the 1000/min cap
    }
  });
});

describe('Stripe webhook mount pattern (mirrors routes/index.js)', () => {
  // Regression test for the double-throttling bug: router.use('/stripe',
  // apiLimiter) used to apply unconditionally, so a burst of webhook retries
  // got throttled at the standard 100/min cap despite stripeLimiter's
  // 1000/min allowance. The apiLimiter mount must skip the (mount-relative)
  // '/webhook' path.
  function mountStripeLikeRoutesIndex() {
    const app = express();
    app.use(express.json());
    const stripeSubRouter = express.Router();
    stripeSubRouter.post('/webhook', (_req, res) => res.json({ ok: true, via: 'webhook' }));
    stripeSubRouter.post('/other', (_req, res) => res.json({ ok: true, via: 'other' }));

    app.use('/stripe/webhook', stripeLimiter);
    app.use('/stripe', (req, res, next) => (req.path === '/webhook' ? next() : apiLimiter(req, res, next)));
    app.use('/stripe', stripeSubRouter);
    return app;
  }

  it('lets webhook traffic exceed the standard 100/min apiLimiter cap', async () => {
    const app = mountStripeLikeRoutesIndex();
    const ip = '10.50.0.1';
    for (let i = 0; i < 110; i++) {
      const res = await request(app).post('/stripe/webhook').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
  });

  it('still applies the standard apiLimiter to non-webhook stripe endpoints', async () => {
    const app = mountStripeLikeRoutesIndex();
    const ip = '10.50.0.2';
    for (let i = 0; i < 100; i++) {
      expect((await request(app).post('/stripe/other').set('X-Forwarded-For', ip)).status).toBe(200);
    }
    const blocked = await request(app).post('/stripe/other').set('X-Forwarded-For', ip);
    expect(blocked.status).toBe(429);
  });
});
