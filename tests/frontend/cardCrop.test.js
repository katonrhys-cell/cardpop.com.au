import { describe, it, expect } from 'vitest';
import {
  orderCorners,
  quadArea,
  quadSides,
  isPlausibleCard,
  outputDimsFor,
  defaultCorners,
  cornerAngles,
  maxAngleError,
  aspectStatus,
  cropGuideStatus,
  rectifyToCard,
  CARD_RATIO,
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

describe('defaultCorners', () => {
  it('returns an inset rectangle ordered [tl, tr, br, bl]', () => {
    // 8% inset of a 1000×1000 image → 80..920
    expect(defaultCorners(1000, 1000)).toEqual([[80, 80], [920, 80], [920, 920], [80, 920]]);
  });

  it('respects a custom inset', () => {
    expect(defaultCorners(1000, 2000, 0.1)).toEqual([[100, 200], [900, 200], [900, 1800], [100, 1800]]);
  });

  it('produces a plausible card quad for a portrait frame', () => {
    // A 1000×1400 frame inset 8% is ~840×1288 → ratio ~0.65, within card range.
    expect(isPlausibleCard(defaultCorners(1000, 1400), 1000, 1400)).toBe(true);
  });
});

describe('cornerAngles / maxAngleError', () => {
  it('reports four right angles for a rectangle', () => {
    cornerAngles(CARD_SEQ).forEach(a => expect(a).toBeCloseTo(90));
    expect(maxAngleError(CARD_SEQ)).toBeCloseTo(0);
  });

  it('reports a non-zero error for a skewed quad', () => {
    const skewed = [[250, 100], [600, 100], [600, 800], [100, 800]];
    expect(maxAngleError(skewed)).toBeGreaterThan(5);
  });
});

describe('aspectStatus', () => {
  it('matches the card ratio for a 5:7 rectangle', () => {
    const s = aspectStatus(CARD_SEQ);
    expect(s.ratio).toBeCloseTo(CARD_RATIO);
    expect(s.matchesCard).toBe(true);
  });

  it('rejects a square shape', () => {
    const square = [[0, 0], [500, 0], [500, 500], [0, 500]];
    expect(aspectStatus(square).matchesCard).toBe(false);
  });

  it('handles degenerate input', () => {
    const zero = [[0, 0], [0, 0], [0, 0], [0, 0]];
    expect(aspectStatus(zero)).toEqual({ ratio: 0, matchesCard: false });
  });
});

describe('cropGuideStatus', () => {
  it('is perfect for a clean 5:7 rectangle', () => {
    const s = cropGuideStatus(CARD_SEQ);
    expect(s.isRectangle).toBe(true);
    expect(s.matchesCard).toBe(true);
    expect(s.isPerfect).toBe(true);
  });

  it('is not perfect when edges are skewed', () => {
    const skewed = [[250, 100], [600, 100], [600, 800], [100, 800]];
    expect(cropGuideStatus(skewed).isPerfect).toBe(false);
  });
});

describe('rectifyToCard', () => {
  it('turns a skewed quad into a right-angled card rectangle', () => {
    const skewed = [[150, 100], [600, 120], [580, 800], [100, 780]];
    const rect = rectifyToCard(skewed, 1000, 1000);
    expect(maxAngleError(rect)).toBeCloseTo(0);
    expect(aspectStatus(rect).matchesCard).toBe(true);
    expect(cropGuideStatus(rect).isPerfect).toBe(true);
  });

  it('keeps the rectangle inside the frame', () => {
    const big = [[-50, -50], [1100, -50], [1100, 1100], [-50, 1100]];
    const rect = rectifyToCard(big, 1000, 1000);
    rect.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1000);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1000);
    });
  });
});
