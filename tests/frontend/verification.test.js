import { describe, it, expect } from 'vitest';
import { isVerified } from '@/utils/verification.js';

describe('isVerified', () => {
  it('treats boolean true and string "true" as verified', () => {
    expect(isVerified(true)).toBe(true);
    expect(isVerified('true')).toBe(true);
  });

  it('treats everything else as not verified', () => {
    expect(isVerified(false)).toBe(false);
    expect(isVerified('false')).toBe(false);
    expect(isVerified('pending')).toBe(false);
    expect(isVerified(null)).toBe(false);
    expect(isVerified(undefined)).toBe(false);
    expect(isVerified(1)).toBe(false);
  });
});
