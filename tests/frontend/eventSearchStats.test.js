import { describe, it, expect } from 'vitest';
import { formatCtr, formatPosition, describeRange } from '@/utils/eventSearchStats.js';

describe('eventSearchStats', () => {
  it('formats click rate', () => {
    expect(formatCtr(0.035)).toBe('3.5%');
    expect(formatCtr(0.1234)).toBe('12%');
    expect(formatCtr(0)).toBe('0%');
    expect(formatCtr(undefined)).toBe('0%');
  });
  it('formats position, with a dash when there were no impressions', () => {
    expect(formatPosition(8.24)).toBe('8.2');
    expect(formatPosition(3)).toBe('3');
    expect(formatPosition(null)).toBe('—');
  });
  it('describes the window', () => {
    expect(describeRange('2026-10-13', '2026-11-09')).toBe('13 Oct – 9 Nov 2026');
    expect(describeRange(undefined, undefined)).toBe('');
  });
});
