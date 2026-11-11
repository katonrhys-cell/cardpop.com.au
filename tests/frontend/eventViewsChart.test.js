import { describe, it, expect } from 'vitest';
import { niceMax, summarizeSeries, barGeometry, describeSeries, axisTicks, shortDay, longDay } from '@/utils/eventViewsChart.js';

const day = (n, views) => ({ day: `2026-11-${String(n).padStart(2, '0')}`, views });

describe('niceMax', () => {
  it('keeps small whole counts and rounds larger ones up to 1/2/5 × 10ⁿ', () => {
    expect([1, 3, 5].map(niceMax)).toEqual([1, 3, 5]);
    expect([6, 7, 12, 23, 51, 99, 100, 101, 1234].map(niceMax)).toEqual([10, 10, 20, 50, 100, 100, 100, 200, 2000]);
  });
  it('never returns less than 1', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(undefined)).toBe(1);
    expect(niceMax(-4)).toBe(1);
  });
});

describe('summarizeSeries', () => {
  it('totals and finds the busiest day (first one on a tie)', () => {
    expect(summarizeSeries([day(1, 2), day(2, 9), day(3, 9), day(4, 0)])).toEqual({ total: 20, peak: { day: '2026-11-02', views: 9 }, days: 4 });
  });
  it('has no peak when nobody visited, and copes with junk', () => {
    expect(summarizeSeries([day(1, 0), day(2, 0)])).toEqual({ total: 0, peak: null, days: 2 });
    expect(summarizeSeries(null)).toEqual({ total: 0, peak: null, days: 0 });
  });
});

describe('barGeometry', () => {
  const opts = { width: 300, height: 100, gap: 2 };
  it('makes one bar per day, evenly spaced across the width', () => {
    const { bars } = barGeometry([day(1, 1), day(2, 1), day(3, 1)], opts);
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => b.x)).toEqual([1, 101, 201]);
    expect(bars.every((b) => b.w === 98)).toBe(true);
  });
  it('scales heights to the axis top and sits bars on the baseline', () => {
    const { bars, yMax } = barGeometry([day(1, 10), day(2, 5), day(3, 0)], opts);
    expect(yMax).toBe(10);
    expect(bars[0]).toMatchObject({ h: 100, y: 0 });
    expect(bars[1]).toMatchObject({ h: 50, y: 50 });
    expect(bars[2]).toMatchObject({ h: 0, y: 100 });
  });
  it('keeps a day with a view visible against a huge day, but a zero day flat', () => {
    const { bars } = barGeometry([day(1, 1), day(2, 5000), day(3, 0)], opts);
    expect(bars[0].h).toBe(2);
    expect(bars[2].h).toBe(0);
  });
  it('handles an empty series', () => {
    expect(barGeometry([])).toEqual({ bars: [], yMax: 1 });
  });
});

describe('axisTicks', () => {
  it('skips the half-way line on whole-number scales up to 5', () => {
    expect(axisTicks(1)).toEqual([0, 1]);
    expect(axisTicks(5)).toEqual([0, 1]);
    expect(axisTicks(10)).toEqual([0, 0.5, 1]);
  });
});

describe('describeSeries / day labels', () => {
  it('says it all in a sentence', () => {
    expect(describeSeries([day(1, 2), day(2, 9)])).toBe(`11 views in the last 2 days; busiest day ${longDay('2026-11-02')} with 9.`);
    expect(describeSeries([day(1, 1)])).toMatch(/^1 view in the last 1 days/);
    expect(describeSeries([day(1, 0), day(2, 0)])).toBe('No views in the last 2 days.');
    expect(describeSeries([])).toBe('No view data.');
  });
  it('formats days in Australian style, independent of the viewer’s timezone', () => {
    expect(shortDay('2026-11-11')).toBe('11 Nov');
    // ICU versions differ on the comma after the weekday.
    expect(longDay('2026-11-11')).toMatch(/^Wed,? 11 Nov$/);
  });
});
