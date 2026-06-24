import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import errorMiddleware from '../../../src/middleware/error.js';

function makeRes({ headersSent = false } = {}) {
  return {
    headersSent,
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const ORIGINAL_ENV = process.env.NODE_ENV;
beforeEach(() => vi.clearAllMocks());
afterEach(() => { process.env.NODE_ENV = ORIGINAL_ENV; });

describe('errorMiddleware', () => {
  it('returns the error message and stack outside production', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('boom');
    const res = makeRes();
    errorMiddleware(err, {}, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('boom');
    expect(res.body.stack).toBe(err.stack);
  });

  it('hides the message and stack in production', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorMiddleware(new Error('sensitive detail'), {}, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Something went wrong!');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('delegates to next when headers have already been sent', () => {
    const err = new Error('late');
    const res = makeRes({ headersSent: true });
    const next = vi.fn();
    errorMiddleware(err, {}, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.statusCode).toBeNull();
  });
});
