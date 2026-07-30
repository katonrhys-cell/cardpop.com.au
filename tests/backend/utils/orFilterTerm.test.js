import { describe, it, expect } from 'vitest';
import { orFilterTerm } from '../../../src/utils/orFilterTerm.js';

describe('orFilterTerm', () => {
  it('strips the PostgREST .or() grammar characters', () => {
    // A comma would split one condition into two, silently rewriting the query.
    expect(orFilterTerm('Smith, J')).toBe('Smith J');
    expect(orFilterTerm('Cards (AU)')).toBe('Cards AU');
    expect(orFilterTerm('a"b')).toBe('a b');
    expect(orFilterTerm('a:b')).toBe('a b');
  });

  it('strips LIKE wildcards and the escape character', () => {
    // `%`/`_` would match every row and force a full table scan; PostgREST
    // additionally treats `*` as an alias for `%` in like/ilike.
    expect(orFilterTerm('%')).toBe('');
    expect(orFilterTerm('a%b')).toBe('a b');
    expect(orFilterTerm('a_b')).toBe('a b');
    expect(orFilterTerm('a*b')).toBe('a b');
    expect(orFilterTerm('a\\b')).toBe('a b');
  });

  it('blocks an injected extra condition', () => {
    const injected = orFilterTerm('x,is_admin.eq.true');
    // The comma that would have started a second condition is gone (the `_` is
    // also stripped, being a single-character LIKE wildcard).
    expect(injected).not.toContain(',');
    expect(injected).toBe('x is admin.eq.true');
  });

  it('keeps punctuation that is harmless inside a filter value', () => {
    // PostgREST splits field.operator.value on the first two dots only, so
    // dots, apostrophes and hyphens are safe — and real names need them.
    expect(orFilterTerm("O'Brien")).toBe("O'Brien");
    expect(orFilterTerm('J. Smith')).toBe('J. Smith');
    expect(orFilterTerm('Jean-Luc')).toBe('Jean-Luc');
  });

  it('collapses whitespace and trims', () => {
    expect(orFilterTerm('  a   b  ')).toBe('a b');
    expect(orFilterTerm('a,,,b')).toBe('a b');
  });

  it('clamps length', () => {
    expect(orFilterTerm('a'.repeat(200))).toHaveLength(80);
    expect(orFilterTerm('abcdef', 3)).toBe('abc');
  });

  it('handles non-string input', () => {
    expect(orFilterTerm(null)).toBe('');
    expect(orFilterTerm(undefined)).toBe('');
    expect(orFilterTerm(42)).toBe('42');
  });
});
