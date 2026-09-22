import { describe, it, expect } from 'vitest';
import { escapeLike } from '../../../src/utils/escapeLike.js';

describe('escapeLike', () => {
  it('escapes the LIKE wildcards % and _ and the escape char \\', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });

  it('neutralises a wildcard-only term so it cannot match everything', () => {
    // A raw "%" would match every row and force a full-table scan; escaped it is
    // a literal percent sign.
    expect(escapeLike('%')).toBe('\\%');
    expect(escapeLike('%%%')).toBe('\\%\\%\\%');
  });

  it('escapes the backslash before the wildcards so injection cannot smuggle a wildcard back in', () => {
    // "\%" from a user must become "\\\%": a literal backslash followed by a
    // literal percent — not an escaped percent that re-enables the wildcard.
    expect(escapeLike('\\%')).toBe('\\\\\\%');
  });

  it('strips PostgREST’s `*` wildcard alias (it cannot be backslash-escaped)', () => {
    expect(escapeLike('*')).toBe('');
    expect(escapeLike('Chari*')).toBe('Chari');
    expect(escapeLike('*%*')).toBe('\\%');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLike('Charizard')).toBe('Charizard');
    expect(escapeLike('Pikachu VMAX 2021')).toBe('Pikachu VMAX 2021');
  });

  it('coerces nullish and non-string input to a safe empty/stringified value', () => {
    expect(escapeLike(null)).toBe('');
    expect(escapeLike(undefined)).toBe('');
    expect(escapeLike(42)).toBe('42');
    expect(escapeLike(0)).toBe('0');
  });
});
