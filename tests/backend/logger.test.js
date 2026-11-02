import { describe, it, expect, vi, afterEach } from 'vitest';
import logger, { describeError } from '../../src/utils/logger.js';

// Supabase/PostgREST errors are plain objects, not Error instances. The logger
// used to String() them, so every failed query landed in Vercel's logs as
// "[object Object]" — the 2026-10-25 listing-quota refusals were undiagnosable
// until the DB was queried by hand.
describe('describeError', () => {
  it('keeps message, stack and code for an Error', () => {
    const err = Object.assign(new Error('boom'), { code: 'E_BOOM' });
    const out = describeError(err);
    expect(out.error).toBe('boom');
    expect(out.stack).toContain('boom');
    expect(out.code).toBe('E_BOOM');
  });

  it('names the real cause of a Supabase-style plain-object error', () => {
    const out = describeError({
      message: 'LISTING_QUOTA_EXCEEDED: your plan allows 5 new listings per calendar month and you have used 5.',
      code: 'P0001',
      details: null,
      hint: 'Upgrade',
    });
    expect(out.error).toMatch(/LISTING_QUOTA_EXCEEDED/);
    expect(out.code).toBe('P0001');
    expect(out.hint).toBe('Upgrade');
    expect(out).not.toHaveProperty('details');
    expect(JSON.stringify(out)).not.toContain('[object Object]');
  });

  it('serialises an object with no message instead of printing [object Object]', () => {
    expect(describeError({ foo: 1 }).error).toBe('{"foo":1}');
  });

  it('stringifies primitives and ignores nothing', () => {
    expect(describeError('plain string').error).toBe('plain string');
    expect(describeError(42).error).toBe('42');
    expect(describeError(undefined)).toEqual({});
    expect(describeError(null)).toEqual({});
  });

  it('never throws on a circular object', () => {
    const circular = {};
    circular.self = circular;
    expect(() => describeError(circular)).not.toThrow();
    expect(typeof describeError(circular).error).toBe('string');
  });
});

describe('logger.error', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes one JSON line carrying the plain-object error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('[VAULT] sync failed', { message: 'row violates row-level security policy', code: '42501' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0]);
    expect(line).toMatchObject({
      level: 'error',
      msg: '[VAULT] sync failed',
      error: 'row violates row-level security policy',
      code: '42501',
    });
  });
});
