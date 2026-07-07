import { describe, it, expect } from 'vitest';
import { validatePassword } from '../../../src/utils/passwordValidator.js';

describe('validatePassword', () => {
  it('returns score 0 and all five requirements missing for an empty string', () => {
    const result = validatePassword('');
    expect(result.isStrong).toBe(false);
    expect(result.strengthScore).toBe(0);
    expect(result.missing).toHaveLength(5);
    expect(result.missing).toEqual(
      expect.arrayContaining(['uppercase', 'lowercase', 'numbers', 'specialChars', 'length']),
    );
  });

  it('recognises uppercase letters', () => {
    const result = validatePassword('A');
    expect(result.requirements.uppercase).toBe(true);
    expect(result.missing).not.toContain('uppercase');
  });

  it('recognises lowercase letters', () => {
    const result = validatePassword('a');
    expect(result.requirements.lowercase).toBe(true);
    expect(result.missing).not.toContain('lowercase');
  });

  it('recognises digits', () => {
    const result = validatePassword('1');
    expect(result.requirements.numbers).toBe(true);
    expect(result.missing).not.toContain('numbers');
  });

  it('recognises special characters', () => {
    for (const char of ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')']) {
      const result = validatePassword(char);
      expect(result.requirements.specialChars).toBe(true);
    }
  });

  it('requires at least 8 characters for the length requirement', () => {
    expect(validatePassword('1234567').requirements.length).toBe(false);
    expect(validatePassword('12345678').requirements.length).toBe(true);
  });

  it('isStrong is false when score is exactly 3', () => {
    // uppercase + lowercase + length = 3 (no numbers, no special chars)
    const result = validatePassword('Abcdefgh');
    expect(result.strengthScore).toBe(3);
    expect(result.isStrong).toBe(false);
  });

  it('isStrong is false when score is exactly 4 (missing only special chars)', () => {
    // A >=4 threshold let a password like "Password1" — uppercase + lowercase
    // + numbers + length, no special chars — pass as "strong" despite being a
    // well-known weak/common password. Every category is now required.
    const result = validatePassword('Abcdefg1');
    expect(result.strengthScore).toBe(4);
    expect(result.isStrong).toBe(false);
    expect(result.missing).toEqual(['specialChars']);
  });

  it('isStrong is true and score is 5 for a fully compliant password', () => {
    const result = validatePassword('Correct1!');
    expect(result.isStrong).toBe(true);
    expect(result.strengthScore).toBe(5);
    expect(result.missing).toHaveLength(0);
  });

  it('missing array only lists unmet requirements', () => {
    // Only length is missing
    const result = validatePassword('Aa1!');
    expect(result.missing).toEqual(['length']);
  });

  it('requirements object reflects each criterion independently', () => {
    const result = validatePassword('Correct1!');
    expect(result.requirements.uppercase).toBe(true);
    expect(result.requirements.lowercase).toBe(true);
    expect(result.requirements.numbers).toBe(true);
    expect(result.requirements.specialChars).toBe(true);
    expect(result.requirements.length).toBe(true);
  });
});
