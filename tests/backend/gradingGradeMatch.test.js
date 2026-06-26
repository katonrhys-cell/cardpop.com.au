import { describe, it, expect } from 'vitest';
import {
  extractVerifiedGrade,
  parseGradeValue,
  computeGradeMatch,
} from '../../src/services/gradingVerificationService.js';

// The core anti-fraud logic: comparing a seller's CLAIMED grade against the
// real cert's grade, so a genuine "PSA 9" cert can't be passed off as a "PSA 10".

describe('extractVerifiedGrade', () => {
  it('reads the grade from a PSA cert payload', () => {
    expect(extractVerifiedGrade({ PSACert: { CardGrade: 'GEM-MT 10' } })).toBe('GEM-MT 10');
  });
  it('falls back across shapes', () => {
    expect(extractVerifiedGrade({ cardGrade: '9' })).toBe('9');
    expect(extractVerifiedGrade({ GradeDescription: 'MINT 9' })).toBe('MINT 9');
  });
  it('returns null for empty input', () => {
    expect(extractVerifiedGrade(null)).toBeNull();
    expect(extractVerifiedGrade({})).toBeNull();
  });
});

describe('parseGradeValue', () => {
  it('extracts numeric grades from labels', () => {
    expect(parseGradeValue('PSA 10')).toBe(10);
    expect(parseGradeValue('GEM-MT 10')).toBe(10);
    expect(parseGradeValue('9.5')).toBe(9.5);
    expect(parseGradeValue(10)).toBe(10);
  });
  it('returns null for non-numeric grades', () => {
    expect(parseGradeValue('Authentic')).toBeNull();
    expect(parseGradeValue(null)).toBeNull();
  });
});

describe('computeGradeMatch', () => {
  const psa10 = { PSACert: { CardGrade: 'GEM-MT 10' } };
  const psa9 = { PSACert: { CardGrade: '9' } };

  it('returns true when claimed grade matches the cert', () => {
    expect(computeGradeMatch(psa10, 'PSA 10')).toBe(true);
    expect(computeGradeMatch(psa10, '10')).toBe(true);
  });

  it('returns false when the claim is inflated above the cert (the scam case)', () => {
    expect(computeGradeMatch(psa9, 'PSA 10')).toBe(false);
    expect(computeGradeMatch(psa10, '9.5')).toBe(false);
  });

  it('returns null when there is nothing to compare', () => {
    expect(computeGradeMatch(psa10, null)).toBeNull();
    expect(computeGradeMatch(psa10, '')).toBeNull();
    expect(computeGradeMatch(psa10, 'Authentic')).toBeNull();
    expect(computeGradeMatch({}, 'PSA 10')).toBeNull();
  });
});
