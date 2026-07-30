import { describe, it, expect } from 'vitest';
import { queryString } from '../../../src/utils/queryString.js';

describe('queryString', () => {
  it('passes a plain string through, trimmed', () => {
    expect(queryString('charizard')).toBe('charizard');
    expect(queryString('  charizard  ')).toBe('charizard');
  });

  it('collapses a repeated parameter (array) to its first entry', () => {
    // Express parses ?q=a&q=b into ['a','b'] — the case that made string
    // methods on req.query.* throw and answer 500.
    expect(queryString(['a', 'b'])).toBe('a');
    expect(queryString([' a ', 'b'])).toBe('a');
  });

  it('returns "" for absent or non-string values', () => {
    expect(queryString(undefined)).toBe('');
    expect(queryString(null)).toBe('');
    expect(queryString([])).toBe('');
    // ?q[x]=1 parses to an object under the extended query parser.
    expect(queryString({ x: '1' })).toBe('');
    expect(queryString(42)).toBe('');
  });

  it('never throws for input that would break a string method', () => {
    for (const v of [['a', 'b'], {}, [], null, undefined, 0, false]) {
      expect(() => queryString(v)).not.toThrow();
      expect(typeof queryString(v)).toBe('string');
    }
  });
});
