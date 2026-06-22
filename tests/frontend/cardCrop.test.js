import { describe, it, expect } from 'vitest';
import {
  orderCorners,
  quadArea,
  quadSides,
  isPlausibleCard,
  outputDimsFor,
  OUTPUT,
} from '@/utils/cardCrop.js';

// A 500×700 (5:7) axis-aligned card. CARD_SEQ is wound sequentially around the
// perimeter (as a real contour is); JUMBLED is the same corners out of order.
const CARD_SEQ = [
  [100, 100], // tl
  [600, 100], // tr
  [600, 800], // br
  [100, 800], // bl
];
const JUMBLED = [
  [600, 800], // br
  [100, 100], // tl
  [100, 800], // bl
  [600, 100], // tr
];

describe('orderCorners', () => {
  it('orders jumbled points as [tl, tr, br, bl]', () => {
    expect(orderCorners(JUMBLED)).toEqual([
      [100, 100], // tl
      [600, 100], // tr
      [600, 800], // br
      [100, 800], // bl
    ]);
  });

  it('throws when not given exactly 4 points', () => {
    expect(() => orderCorners([[0, 0], [1, 1], [2, 2]])).toThrow();
  });
});

describe('quadArea', () => {
  it('computes the area of a rectangle regardless of winding', () => {
    expect(quadArea(CARD_SEQ)).toBe(500 * 700);
  });
});

describe('quadSides', () => {
  it('returns averaged width and height', () => {
    expect(quadSides(CARD_SEQ)).toEqual({ width: 500, height: 700 });
  });
});

describe('isPlausibleCard', () => {
  const imgW = 1000, imgH = 1000;

  it('accepts a 5:7 card that fills enough of the frame', () => {
    expect(isPlausibleCard(CARD_SEQ, imgW, imgH)).toBe(true);
  });

  it('rejects a quad that is too small a fraction of the frame', () => {
    const tiny = [[0, 0], [50, 0], [50, 70], [0, 70]]; // 50×70, 0.35% of frame
    expect(isPlausibleCard(tiny, imgW, imgH)).toBe(false);
  });

  it('rejects a near-square region (not card-shaped)', () => {
    const square = [[100, 100], [700, 100], [700, 700], [100, 700]]; // ratio 1.0
    expect(isPlausibleCard(square, imgW, imgH)).toBe(false);
  });

  it('rejects a long thin region', () => {
    const thin = [[0, 0], [900, 0], [900, 150], [0, 150]]; // ratio ~0.17
    expect(isPlausibleCard(thin, imgW, imgH)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isPlausibleCard(null, imgW, imgH)).toBe(false);
    expect(isPlausibleCard([[0, 0], [1, 1]], imgW, imgH)).toBe(false);
    expect(isPlausibleCard(CARD_SEQ, 0, 0)).toBe(false);
  });

  it('still accepts a moderately foreshortened (tilted) card', () => {
    // Top edge shorter than bottom (perspective) but overall ratio in range.
    const tilted = [[150, 100], [550, 100], [600, 800], [100, 800]];
    expect(isPlausibleCard(tilted, imgW, imgH)).toBe(true);
  });
});

describe('outputDimsFor', () => {
  it('returns portrait dimensions for a portrait card', () => {
    expect(outputDimsFor(CARD_SEQ)).toEqual({ width: OUTPUT.width, height: OUTPUT.height });
  });

  it('returns landscape dimensions for a landscape card', () => {
    const landscape = [[100, 100], [800, 100], [800, 600], [100, 600]]; // 700×500
    expect(outputDimsFor(landscape)).toEqual({ width: OUTPUT.height, height: OUTPUT.width });
  });
});
