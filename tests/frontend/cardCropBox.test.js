import { describe, it, expect } from 'vitest';
import { boundsOf, dragRect } from '@/components/CardCornerAdjuster.jsx';

const W = 1000;
const H = 1400;
const box = { x0: 100, y0: 100, x1: 600, y1: 900 };

describe('crop box', () => {
  it('takes the bounding box of a tilted quad, clamped to the image', () => {
    expect(boundsOf([[120, -5], [610, 40], [580, 1500], [90, 1380]], W, H))
      .toEqual({ x0: 90, y0: 0, x1: 610, y1: H });
  });

  it('moves one edge without touching the others', () => {
    expect(dragRect(box, 'e', 50, 999, W, H)).toEqual({ ...box, x1: 650 });
    expect(dragRect(box, 'nw', -30, 20, W, H)).toEqual({ ...box, x0: 70, y0: 120 });
  });

  it('stops edges at the image border and at the minimum size', () => {
    expect(dragRect(box, 'w', -500, 0, W, H).x0).toBe(0);
    const squashed = dragRect(box, 'e', -2000, 0, W, H);
    expect(squashed.x1 - squashed.x0).toBeCloseTo(W * 0.08);
  });

  it('moves the whole box, keeping its size and staying inside the image', () => {
    expect(dragRect(box, 'move', 1000, -1000, W, H)).toEqual({ x0: 500, y0: 0, x1: W, y1: 800 });
  });
});
