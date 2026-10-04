import { describe, it, expect } from 'vitest';
import {
  publicTrafficStat, sparklinePath, formatCompact, formatCount, formatSinceMonth,
  MIN_PUBLIC_VISITORS_30D,
} from '@/utils/siteTraffic.js';

const NOW = new Date('2026-10-04T00:00:00Z').getTime();
const fresh = (over = {}) => ({
  visitors_30d: 4210,
  visitors_all_time: 15300,
  since_date: '2026-06-03',
  synced_at: '2026-10-03T19:25:00Z',
  ...over,
});

describe('publicTrafficStat', () => {
  it('shows last-30-days as the headline and since-launch as the secondary line', () => {
    expect(publicTrafficStat(fresh(), { now: NOW })).toEqual({
      key: 'visitors',
      value: 4210,
      label: 'Visitors · last 30 days',
      sub: '15.3k since Jun 2026',
    });
  });

  it('hides the tile with no row, too few visitors, or a stale sync', () => {
    expect(publicTrafficStat(null, { now: NOW })).toBeNull();
    expect(publicTrafficStat(fresh({ visitors_30d: MIN_PUBLIC_VISITORS_30D - 1 }), { now: NOW })).toBeNull();
    expect(publicTrafficStat(fresh({ synced_at: '2026-09-01T00:00:00Z' }), { now: NOW })).toBeNull();
  });

  it('shows exactly the threshold', () => {
    expect(publicTrafficStat(fresh({ visitors_30d: MIN_PUBLIC_VISITORS_30D }), { now: NOW })?.value).toBe(MIN_PUBLIC_VISITORS_30D);
  });

  it('never shows an all-time figure below the 30-day one, and copes without a launch date', () => {
    const stat = publicTrafficStat(fresh({ visitors_all_time: 10, since_date: null }), { now: NOW });
    expect(stat.sub).toBe('4,210 since launch');
  });
});

describe('formatting', () => {
  it('formatCompact', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(9999)).toBe('9,999');
    expect(formatCompact(15300)).toBe('15.3k');
    expect(formatCompact(150000)).toBe('150k');
    expect(formatCompact(2_500_000)).toBe('2.5M');
  });
  it('formatCount and formatSinceMonth', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(null)).toBe('0');
    expect(formatSinceMonth('2026-06-03')).toBe('Jun 2026');
    expect(formatSinceMonth('nope')).toBeNull();
    expect(formatSinceMonth(null)).toBeNull();
  });
});

describe('sparklinePath', () => {
  it('needs at least two points', () => {
    expect(sparklinePath([])).toBeNull();
    expect(sparklinePath([{ day: '2026-10-01', users: 5 }])).toBeNull();
  });

  it('orders by day, scales to the max and anchors the area to the baseline', () => {
    const s = sparklinePath([
      { day: '2026-10-03', users: 10 },
      { day: '2026-10-01', users: 0 },
      { day: '2026-10-02', users: 5 },
    ], { width: 100, height: 20, pad: 0 });
    expect(s.points.map((p) => p.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(s.max).toBe(10);
    expect(s.points[0]).toMatchObject({ x: 0, y: 20 });
    expect(s.points[1]).toMatchObject({ x: 50, y: 10 });
    expect(s.points[2]).toMatchObject({ x: 100, y: 0 });
    expect(s.line).toBe('M0 20 L50 10 L100 0');
    expect(s.area.endsWith('L100 20 L0 20 Z')).toBe(true);
  });

  it('survives all-zero days without dividing by zero', () => {
    const s = sparklinePath([{ day: '2026-10-01', users: 0 }, { day: '2026-10-02', users: 0 }]);
    expect(s.max).toBe(1);
    expect(s.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});
