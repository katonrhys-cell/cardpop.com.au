import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { generateOTP, generateBackupCodes } from '../../../src/utils/otpGenerator.js';

// ─── generateOTP ──────────────────────────────────────────────────────────────

describe('generateOTP', () => {
  it('returns a string', () => {
    expect(typeof generateOTP()).toBe('string');
  });

  it('is exactly 8 characters long', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateOTP()).toHaveLength(8);
    }
  });

  it('is a numeric string in the range 10000000–99999999', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOTP();
      const num = Number(otp);
      expect(num).toBeGreaterThanOrEqual(10000000);
      expect(num).toBeLessThanOrEqual(99999999);
    }
  });

  it('contains only digit characters', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateOTP()).toMatch(/^\d{8}$/);
    }
  });

  it('produces different codes on successive calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOTP()));
    // With 90 million possible values, 20 calls should almost certainly be unique
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ─── generateBackupCodes ──────────────────────────────────────────────────────

describe('generateBackupCodes', () => {
  it('returns 6 codes by default', () => {
    expect(generateBackupCodes()).toHaveLength(6);
  });

  it('returns exactly the requested count', () => {
    expect(generateBackupCodes(3)).toHaveLength(3);
    expect(generateBackupCodes(10)).toHaveLength(10);
  });

  it('each code is 8 characters long', () => {
    for (const code of generateBackupCodes(6)) {
      expect(code).toHaveLength(8);
    }
  });

  it('each code is uppercase', () => {
    for (const code of generateBackupCodes(6)) {
      expect(code).toBe(code.toUpperCase());
    }
  });

  it('codes within a single batch are unique', () => {
    const codes = generateBackupCodes(6);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('returns an array of strings', () => {
    const codes = generateBackupCodes(4);
    expect(Array.isArray(codes)).toBe(true);
    for (const code of codes) {
      expect(typeof code).toBe('string');
    }
  });
});
