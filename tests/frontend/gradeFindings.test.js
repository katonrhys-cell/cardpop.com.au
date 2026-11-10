import { describe, it, expect } from 'vitest';
import { cleanBox, parseRatio, normaliseGradeGeometry, cornerRegions } from '@/utils/gradeFindings.js';

describe('cleanBox', () => {
  it('keeps a box given in percent of the photo', () => {
    expect(cleanBox({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it('scales 0–1 fractions up to percent', () => {
    expect(cleanBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 })).toEqual({ x: 10, y: 20, w: 50, h: 50 });
  });

  it('clamps a box that runs off the photo and enforces a minimum size', () => {
    expect(cleanBox({ x: 98, y: 50, w: 10, h: 10 })).toEqual({ x: 90, y: 50, w: 10, h: 10 });
    expect(cleanBox({ x: 50, y: 50, w: 0, h: 1 }, { minSize: 3 })).toEqual({ x: 50, y: 50, w: 3, h: 3 });
  });

  it('drops missing, non-numeric and off-photo coordinates', () => {
    expect(cleanBox(null)).toBeNull();
    expect(cleanBox({ x: 'left', y: 10, w: 5, h: 5 })).toBeNull();
    expect(cleanBox({ x: 150, y: 10, w: 5, h: 5 })).toBeNull();
    expect(cleanBox({ x: 10, y: 10, w: 0, h: 0 })).toBeNull();
  });
});

describe('parseRatio', () => {
  it('reads a border ratio that adds up to 100', () => {
    expect(parseRatio('55/45')).toEqual([55, 45]);
    expect(parseRatio('roughly 52 / 48')).toEqual([52, 48]);
  });
  it('rejects anything else', () => {
    expect(parseRatio('60/60')).toBeNull();
    expect(parseRatio('centred')).toBeNull();
    expect(parseRatio(null)).toBeNull();
  });
});

describe('normaliseGradeGeometry', () => {
  const result = {
    cardLocation: { front: { x: 10, y: 5, w: 80, h: 90 }, back: { x: 12, y: 6, w: 76, h: 88 } },
    centeringMeasured: { front: { leftRight: '55/45', topBottom: 'n/a' }, back: null },
    findings: [
      { factor: 'surface', side: 'front', x: 40, y: 60, w: 10, h: 5, severity: 'moderate', description: 'Scratch' },
      { factor: 'corners', side: 'front', x: 10, y: 5, w: 6, h: 6, severity: 'MINOR', description: 'Soft corner' },
      { factor: 'edges', side: 'back', x: 10, y: 50, w: 4, h: 10, severity: 'severe', description: 'Nick' },
      { factor: 'gloss', side: 'front', x: 1, y: 1, w: 5, h: 5 },
      { factor: 'edges', side: 'front', x: 'nope', y: 1 },
    ],
  };

  it('cleans boxes and ratios and numbers findings front-first in reading order', () => {
    const g = normaliseGradeGeometry(result);
    expect(g.cardLocation.front).toEqual({ x: 10, y: 5, w: 80, h: 90 });
    expect(g.centering.front).toEqual({ leftRight: '55/45', topBottom: null });
    expect(g.centering.back).toBeNull();
    expect(g.findings.map((f) => [f.n, f.factor, f.side, f.severity])).toEqual([
      [1, 'corners', 'front', 'minor'],
      [2, 'surface', 'front', 'moderate'],
      [3, 'edges', 'back', 'minor'],
    ]);
  });

  it('drops back-side geometry when no back photo was supplied', () => {
    const g = normaliseGradeGeometry(result, { hasBack: false });
    expect(g.cardLocation.back).toBeNull();
    expect(g.findings.every((f) => f.side === 'front')).toBe(true);
  });

  it('copes with an older reply that has none of the located fields', () => {
    expect(normaliseGradeGeometry({ grades: {} })).toEqual({
      cardLocation: { front: null, back: null },
      centering: { front: null, back: null },
      findings: [],
    });
  });
});

describe('cornerRegions', () => {
  it('puts a square-on-screen region in each corner of the card box', () => {
    const regions = cornerRegions({ x: 10, y: 10, w: 50, h: 70 }, 0.5);
    expect(regions.map((r) => r.key)).toEqual(['tl', 'tr', 'bl', 'br']);
    expect(regions[0]).toEqual({ key: 'tl', x: 10, y: 10, w: 10, h: 5 });
    expect(regions[3].x + regions[3].w).toBeCloseTo(60);
    expect(regions[3].y + regions[3].h).toBeCloseTo(80);
    expect(cornerRegions(null)).toEqual([]);
  });
});
