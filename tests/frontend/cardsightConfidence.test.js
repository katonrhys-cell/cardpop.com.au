import { describe, it, expect } from 'vitest';
import {
  confidenceRank,
  confidenceScore,
  confidenceLabel,
  isLowConfidence,
} from '@/utils/cardsightConfidence.js';

describe('confidenceScore', () => {
  it('maps the CardSight enum to the midpoint of its documented band', () => {
    expect(confidenceScore('High')).toBeCloseTo(0.95, 2);
    expect(confidenceScore('Medium')).toBeCloseTo(0.82, 2);
    expect(confidenceScore('Low')).toBeCloseTo(0.62, 2);
  });

  it('never returns NaN for the enum — the bug that rendered "NaN%"', () => {
    for (const tier of ['High', 'Medium', 'Low']) {
      expect(Number.isNaN(confidenceScore(tier))).toBe(false);
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(confidenceScore(' high ')).toBeCloseTo(0.95, 2);
    expect(confidenceScore('MEDIUM')).toBeCloseTo(0.82, 2);
  });

  it('passes through numeric scores and rescales percentages', () => {
    expect(confidenceScore(0.5)).toBe(0.5);
    expect(confidenceScore(88)).toBeCloseTo(0.88, 2);
  });

  it('clamps out-of-range numbers', () => {
    expect(confidenceScore(-3)).toBe(0);
    expect(confidenceScore(140)).toBe(1);
  });

  it('returns null for unknown values so callers can hide the meter', () => {
    expect(confidenceScore(undefined)).toBeNull();
    expect(confidenceScore(null)).toBeNull();
    expect(confidenceScore('')).toBeNull();
    expect(confidenceScore('probably')).toBeNull();
    expect(confidenceScore(Number.NaN)).toBeNull();
  });
});

describe('confidenceRank', () => {
  it('orders the tiers High > Medium > Low > unknown', () => {
    expect(confidenceRank('High')).toBeGreaterThan(confidenceRank('Medium'));
    expect(confidenceRank('Medium')).toBeGreaterThan(confidenceRank('Low'));
    expect(confidenceRank('Low')).toBeGreaterThan(confidenceRank('nonsense'));
    expect(confidenceRank(undefined)).toBe(0);
  });
});

describe('confidenceLabel', () => {
  it('normalises enum casing', () => {
    expect(confidenceLabel('high')).toBe('High');
    expect(confidenceLabel('MEDIUM')).toBe('Medium');
  });

  it('derives a label from a numeric score', () => {
    expect(confidenceLabel(0.97)).toBe('High');
    expect(confidenceLabel(0.8)).toBe('Medium');
    expect(confidenceLabel(0.55)).toBe('Low');
  });

  it('returns null when there is nothing to label', () => {
    expect(confidenceLabel(undefined)).toBeNull();
    expect(confidenceLabel('unrecognised')).toBeNull();
  });
});

describe('isLowConfidence', () => {
  it('treats Low and unknown as needing review', () => {
    expect(isLowConfidence('Low')).toBe(true);
    expect(isLowConfidence(undefined)).toBe(true);
  });

  it('accepts Medium and High as usable', () => {
    expect(isLowConfidence('Medium')).toBe(false);
    expect(isLowConfidence('High')).toBe(false);
  });
});
