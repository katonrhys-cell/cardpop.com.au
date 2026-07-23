import { describe, it, expect } from 'vitest';
import { shouldAutoIdentify } from '@/utils/listingFlow.js';

const base = { isEdit: false, cardName: '', isScanning: false, isIdentifying: false };

describe('shouldAutoIdentify', () => {
  it('runs for a fresh photo on a new card', () => {
    expect(shouldAutoIdentify(base)).toBe(true);
  });

  it('never runs in edit mode', () => {
    expect(shouldAutoIdentify({ ...base, isEdit: true })).toBe(false);
  });

  it('never overwrites an already-filled card name', () => {
    expect(shouldAutoIdentify({ ...base, cardName: 'Charizard' })).toBe(false);
  });

  it('treats a whitespace-only card name as empty', () => {
    expect(shouldAutoIdentify({ ...base, cardName: '   ' })).toBe(true);
  });

  it('does not stack runs while an analysis is in flight', () => {
    expect(shouldAutoIdentify({ ...base, isScanning: true })).toBe(false);
    expect(shouldAutoIdentify({ ...base, isIdentifying: true })).toBe(false);
  });

  it('handles a missing card name safely', () => {
    expect(shouldAutoIdentify({ ...base, cardName: undefined })).toBe(true);
  });
});
