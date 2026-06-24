import { vi, describe, it, expect, beforeEach } from 'vitest';
import { customSecurityHeaders, noCacheHeaders } from '../../../src/middleware/secureHeaders.js';

function makeRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) { headers[name] = value; },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('customSecurityHeaders', () => {
  it('sets the expected hardening headers and calls next', () => {
    const res = makeRes();
    const next = vi.fn();
    customSecurityHeaders({}, res, next);

    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['X-Frame-Options']).toBe('DENY');
    expect(res.headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(res.headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['Permissions-Policy']).toContain('camera=()');
    expect(res.headers['X-DNS-Prefetch-Control']).toBe('off');
    expect(res.headers['Cache-Control']).toBe('public, max-age=3600, must-revalidate');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('noCacheHeaders', () => {
  it('disables caching and calls next', () => {
    const res = makeRes();
    const next = vi.fn();
    noCacheHeaders({}, res, next);

    expect(res.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(res.headers['Pragma']).toBe('no-cache');
    expect(res.headers['Expires']).toBe('0');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
