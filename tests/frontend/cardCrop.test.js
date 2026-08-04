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
  isRectangularQuad,
  rectifyQuad,
  isConvexQuad,
  quadContains,
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

describe('isConvexQuad', () => {
  it('accepts a sequentially wound rectangle', () => {
    expect(isConvexQuad(CARD_SEQ)).toBe(true);
  });

  it('rejects the same corners wound as a bow-tie', () => {
    expect(isConvexQuad(JUMBLED)).toBe(false);
  });

  it('accepts a tilted convex quad', () => {
    const tilted = [[150, 100], [550, 130], [590, 780], [110, 800]];
    expect(isConvexQuad(tilted)).toBe(true);
  });

  it('rejects a quad with a corner pushed inside (concave)', () => {
    // Bottom-right corner dragged deep into the shape.
    const concave = [[100, 100], [600, 100], [300, 450], [100, 800]];
    expect(isConvexQuad(concave)).toBe(false);
  });

  it('rejects degenerate input', () => {
    expect(isConvexQuad(null)).toBe(false);
    expect(isConvexQuad([[0, 0], [1, 1], [2, 2]])).toBe(false);
    expect(isConvexQuad([[0, 0], [0, 0], [0, 0], [0, 0]])).toBe(false);
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

  it('snaps a near-5:7 quad (perspective bias) to the standard card output', () => {
    // 496×700 → ratio 0.709, within 6% of 5:7 — a real card seen slightly askew.
    const nearCard = [[100, 100], [596, 100], [596, 800], [100, 800]];
    expect(outputDimsFor(nearCard)).toEqual({ width: OUTPUT.width, height: OUTPUT.height });
  });

  it('keeps a graded slab at its own aspect instead of squashing it to 5:7', () => {
    // 430×700 → ratio ~0.614, a PSA-case shape.
    const slab = [[100, 100], [530, 100], [530, 800], [100, 800]];
    const dims = outputDimsFor(slab);
    expect(dims.height).toBe(OUTPUT.height);
    expect(dims.width).toBe(Math.round(OUTPUT.height * (430 / 700)));
    expect(dims.width).not.toBe(OUTPUT.width);
  });
});

describe('quadContains', () => {
  const outer = [[100, 100], [700, 100], [700, 1000], [100, 1000]];

  it('accepts a quad fully inside another', () => {
    const inner = [[200, 250], [600, 250], [600, 850], [200, 850]];
    expect(quadContains(outer, inner)).toBe(true);
  });

  it('accepts an inner quad grazing the boundary within tolerance', () => {
    const grazing = [[95, 105], [700, 100], [700, 995], [100, 1000]];
    expect(quadContains(outer, grazing)).toBe(true);
  });

  it('rejects a quad that pokes well outside', () => {
    const poking = [[200, 250], [850, 250], [600, 850], [200, 850]];
    expect(quadContains(outer, poking)).toBe(false);
  });

  it('rejects overlapping-but-not-nested quads and malformed input', () => {
    const shifted = outer.map(([x, y]) => [x + 400, y]);
    expect(quadContains(outer, shifted)).toBe(false);
    expect(quadContains(null, outer)).toBe(false);
    expect(quadContains(outer, [[0, 0]])).toBe(false);
  });

  it('is winding-order agnostic for the outer quad', () => {
    const reversed = [...outer].reverse();
    const inner = [[200, 250], [600, 250], [600, 850], [200, 850]];
    expect(quadContains(reversed, inner)).toBe(true);
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

describe('cornerAngles', () => {
  it('reports four right angles for a rectangle', () => {
    cornerAngles(CARD_SEQ).forEach(a => expect(a).toBeCloseTo(90, 5));
  });

  it('reports skewed angles for a sheared quad', () => {
    // A parallelogram (top edge shifted right) has no 90° corners.
    const sheared = [[200, 100], [700, 100], [600, 800], [100, 800]];
    const angles = cornerAngles(sheared);
    expect(Math.max(...angles.map(a => Math.abs(a - 90)))).toBeGreaterThan(5);
  });
});

describe('maxAngleError / isRectangularQuad', () => {
  it('treats a clean rectangle as rectangular', () => {
    expect(maxAngleError(CARD_SEQ)).toBeCloseTo(0, 5);
    expect(isRectangularQuad(CARD_SEQ)).toBe(true);
  });

  it('tolerates a tiny skew within the default tolerance', () => {
    const nearly = [[100, 100], [600, 102], [600, 800], [100, 798]]; // ~0.2° off
    expect(isRectangularQuad(nearly)).toBe(true);
  });

  it('rejects a clearly skewed quad', () => {
    const sheared = [[250, 100], [700, 100], [550, 800], [100, 800]];
    expect(isRectangularQuad(sheared)).toBe(false);
  });
});

describe('rectifyQuad', () => {
  it('returns an upright rectangle ordered [tl, tr, br, bl]', () => {
    const rect = rectifyQuad(CARD_SEQ);
    expect(rect).toEqual(orderCorners(rect));
    expect(isRectangularQuad(rect)).toBe(true);
  });

  it('preserves the centre and average size of a skewed quad', () => {
    const sheared = [[250, 100], [700, 100], [550, 800], [100, 800]];
    const rect = rectifyQuad(sheared);
    // Centre is unchanged…
    const cx = sheared.reduce((s, p) => s + p[0], 0) / 4;
    const cy = sheared.reduce((s, p) => s + p[1], 0) / 4;
    expect((rect[0][0] + rect[1][0]) / 2).toBeCloseTo(cx, 5);
    expect((rect[0][1] + rect[3][1]) / 2).toBeCloseTo(cy, 5);
    // …and the result is a true rectangle.
    expect(isRectangularQuad(rect)).toBe(true);
  });
});
