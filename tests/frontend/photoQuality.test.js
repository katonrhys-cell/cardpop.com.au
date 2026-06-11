import { describe, it, expect } from 'vitest';
import {
  PHOTO_STANDARD,
  QUALITY_WEIGHTS,
  computeLuma,
  meanLuma,
  blownHighlightRatio,
  laplacianVariance,
  subjectFillRatio,
  scoreResolution,
  scoreSharpness,
  scoreLighting,
  scoreGlare,
  scoreCropFill,
  computeOverallScore,
  buildQualityResult,
} from '@/utils/photoQuality.js';

// Builds a luma array of the given size filled with `value`
const flat = (width, height, value) => new Float32Array(width * height).fill(value);

describe('computeLuma', () => {
  it('converts RGBA to perceptual luma', () => {
    // Pure white pixel
    const white = computeLuma(new Uint8ClampedArray([255, 255, 255, 255]));
    expect(white[0]).toBeCloseTo(255, 0);
    // Pure black pixel
    const black = computeLuma(new Uint8ClampedArray([0, 0, 0, 255]));
    expect(black[0]).toBe(0);
    // Green contributes the most to luma
    const green = computeLuma(new Uint8ClampedArray([0, 255, 0, 255]));
    const blue = computeLuma(new Uint8ClampedArray([0, 0, 255, 255]));
    expect(green[0]).toBeGreaterThan(blue[0]);
  });
});

describe('meanLuma', () => {
  it('returns the average brightness', () => {
    expect(meanLuma(flat(4, 4, 128))).toBe(128);
  });

  it('returns 0 for empty input', () => {
    expect(meanLuma(new Float32Array(0))).toBe(0);
  });
});

describe('blownHighlightRatio', () => {
  it('is 0 with no blown pixels', () => {
    expect(blownHighlightRatio(flat(4, 4, 200))).toBe(0);
  });

  it('reports the fraction of blown pixels', () => {
    const luma = flat(2, 2, 100);
    luma[0] = 255;
    expect(blownHighlightRatio(luma)).toBe(0.25);
  });
});

describe('laplacianVariance', () => {
  it('is 0 for a flat image (maximum blur)', () => {
    expect(laplacianVariance(flat(10, 10, 128), 10, 10)).toBe(0);
  });

  it('is high for a checkerboard (sharp edges everywhere)', () => {
    const w = 10, h = 10;
    const luma = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        luma[y * w + x] = (x + y) % 2 === 0 ? 0 : 255;
      }
    }
    expect(laplacianVariance(luma, w, h)).toBeGreaterThan(1000);
  });

  it('returns 0 for images too small to analyze', () => {
    expect(laplacianVariance(flat(2, 2, 50), 2, 2)).toBe(0);
  });
});

describe('subjectFillRatio', () => {
  // White background with a dark rectangle "card" in the middle
  const makeCardImage = (w, h, cardW, cardH) => {
    const luma = flat(w, h, 250);
    const x0 = Math.floor((w - cardW) / 2);
    const y0 = Math.floor((h - cardH) / 2);
    for (let y = y0; y < y0 + cardH; y++) {
      for (let x = x0; x < x0 + cardW; x++) {
        luma[y * w + x] = 60;
      }
    }
    return luma;
  };

  it('returns ~0 for an empty background', () => {
    expect(subjectFillRatio(flat(20, 20, 250), 20, 20)).toBe(0);
  });

  it('measures the bounding box of the subject', () => {
    // 10×10 card centred in a 20×20 frame → 100/400 = 0.25
    const luma = makeCardImage(20, 20, 10, 10);
    expect(subjectFillRatio(luma, 20, 20)).toBeCloseTo(0.25, 2);
  });

  it('approaches 1 when the card fills the frame', () => {
    const luma = makeCardImage(20, 20, 18, 18);
    expect(subjectFillRatio(luma, 20, 20)).toBeGreaterThan(0.7);
  });
});

describe('scoreResolution', () => {
  it('gives 100 at the premium tier', () => {
    expect(scoreResolution(2250, PHOTO_STANDARD.premiumHeight)).toBe(100);
  });

  it('gives 85+ at the recommended tier', () => {
    expect(scoreResolution(1500, PHOTO_STANDARD.recommendedHeight)).toBe(85);
  });

  it('gives 60 at the minimum tier', () => {
    expect(scoreResolution(900, PHOTO_STANDARD.minHeight)).toBe(60);
  });

  it('scores below 60 under the minimum', () => {
    expect(scoreResolution(450, 600)).toBeLessThan(60);
    expect(scoreResolution(0, 0)).toBe(0);
  });

  it('is monotonic in height', () => {
    expect(scoreResolution(1200, 1600)).toBeGreaterThan(scoreResolution(1200, 1300));
  });
});

describe('scoreSharpness', () => {
  it('caps at 100 for very sharp images', () => {
    expect(scoreSharpness(10000)).toBe(100);
  });

  it('gives 0 for a perfectly flat image', () => {
    expect(scoreSharpness(0)).toBe(0);
  });
});

describe('scoreLighting', () => {
  it('gives 100 inside the well-exposed band', () => {
    expect(scoreLighting(120)).toBe(100);
    expect(scoreLighting(160)).toBe(100);
    expect(scoreLighting(190)).toBe(100);
  });

  it('penalizes underexposure', () => {
    expect(scoreLighting(60)).toBeLessThan(50);
    expect(scoreLighting(30)).toBe(0);
  });

  it('penalizes overexposure', () => {
    expect(scoreLighting(220)).toBeLessThan(60);
    expect(scoreLighting(250)).toBe(0);
  });
});

describe('scoreGlare', () => {
  it('gives 100 for negligible blown highlights', () => {
    expect(scoreGlare(0)).toBe(100);
    expect(scoreGlare(0.01)).toBe(100);
  });

  it('drops to 0 at heavy glare', () => {
    expect(scoreGlare(0.15)).toBe(0);
    expect(scoreGlare(0.5)).toBe(0);
  });

  it('falls off in between', () => {
    const mid = scoreGlare(0.08);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });
});

describe('scoreCropFill', () => {
  it('gives 100 near the 85% target', () => {
    expect(scoreCropFill(0.85)).toBe(100);
    expect(scoreCropFill(0.78)).toBe(100);
    expect(scoreCropFill(0.93)).toBe(100);
  });

  it('penalizes a card that is too small in frame', () => {
    expect(scoreCropFill(0.4)).toBeLessThan(scoreCropFill(0.6));
    expect(scoreCropFill(0.1)).toBe(0);
  });
});

describe('computeOverallScore', () => {
  it('returns 100 when all checks are perfect', () => {
    const perfect = Object.fromEntries(Object.keys(QUALITY_WEIGHTS).map((k) => [k, 100]));
    expect(computeOverallScore(perfect)).toBe(100);
  });

  it('weights the checks', () => {
    const scores = Object.fromEntries(Object.keys(QUALITY_WEIGHTS).map((k) => [k, 100]));
    scores.resolution = 0; // weight 25
    expect(computeOverallScore(scores)).toBe(75);
  });

  it('returns 0 when no scores are provided', () => {
    expect(computeOverallScore({})).toBe(0);
  });
});

describe('buildQualityResult', () => {
  it('assembles an overall score and per-check breakdown', () => {
    const result = buildQualityResult({
      width: 1200,
      height: 1680,
      metrics: { meanLuma: 150, blownRatio: 0, laplacianVariance: 300, fillRatio: 0.85 },
    });
    expect(result.width).toBe(1200);
    expect(result.height).toBe(1680);
    expect(result.checks).toHaveLength(5);
    for (const check of result.checks) {
      expect(check).toMatchObject({
        key: expect.any(String),
        label: expect.any(String),
        score: expect.any(Number),
        hint: expect.any(String),
      });
      expect(check.score).toBeGreaterThanOrEqual(0);
      expect(check.score).toBeLessThanOrEqual(100);
    }
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    // A well-lit, sharp, well-framed photo at minimum resolution scores well
    expect(result.overall).toBeGreaterThan(80);
  });
});
