import { describe, it, expect } from 'vitest';
import { imageFitForRatio, eventImageFit } from '@/utils/eventImageFit.js';

describe('event card image fit', () => {
  it('fills the frame for banners close to its shape', () => {
    expect(imageFitForRatio(2, 1.9)).toBe('cover');
    expect(imageFitForRatio(16 / 9, 1.9)).toBe('cover');
    expect(imageFitForRatio(1.3, 1.9)).toBe('cover');
  });

  it('shows a tall portrait flyer whole', () => {
    expect(imageFitForRatio(0.7, 1.9)).toBe('contain');
    expect(imageFitForRatio(5, 1.9)).toBe('contain');
  });

  it('defaults to cover when sizes are unknown', () => {
    expect(imageFitForRatio(0, 1.9)).toBe('cover');
    expect(eventImageFit(null)).toBe('cover');
    expect(eventImageFit({ naturalWidth: 800, naturalHeight: 400, parentElement: { clientWidth: 0, clientHeight: 192 } })).toBe('cover');
  });

  it('reads the image and its frame', () => {
    const frame = { clientWidth: 368, clientHeight: 192 };
    expect(eventImageFit({ naturalWidth: 1200, naturalHeight: 630, parentElement: frame })).toBe('cover');
    expect(eventImageFit({ naturalWidth: 600, naturalHeight: 900, parentElement: frame })).toBe('contain');
  });
});
