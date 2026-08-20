import { describe, it, expect } from 'vitest';
import { sortBoardPosts, sortStalls, clampStallPosition } from '@/lib/eventBoard.js';

describe('sortBoardPosts', () => {
  it('puts pinned posts first, newest first within each group', () => {
    const posts = [
      { id: 'a', is_pinned: false, created_at: '2026-08-01T00:00:00Z' },
      { id: 'b', is_pinned: true, created_at: '2026-07-01T00:00:00Z' },
      { id: 'c', is_pinned: false, created_at: '2026-08-10T00:00:00Z' },
      { id: 'd', is_pinned: true, created_at: '2026-08-05T00:00:00Z' },
    ];
    expect(sortBoardPosts(posts).map((p) => p.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const posts = [
      { id: 'a', is_pinned: false, created_at: '2026-08-01T00:00:00Z' },
      { id: 'b', is_pinned: true, created_at: '2026-07-01T00:00:00Z' },
    ];
    sortBoardPosts(posts);
    expect(posts.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('sortStalls', () => {
  it('orders by sort_order then a natural compare on the label', () => {
    const stalls = [
      { id: 'x', label: 'Stall 10', sort_order: 0 },
      { id: 'y', label: 'Stall 2', sort_order: 0 },
      { id: 'z', label: 'A1', sort_order: 1 },
    ];
    expect(sortStalls(stalls).map((s) => s.id)).toEqual(['y', 'x', 'z']);
  });

  it('handles missing labels and sort orders', () => {
    const stalls = [{ id: 'a' }, { id: 'b', label: '1' }];
    expect(sortStalls(stalls).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('clampStallPosition', () => {
  it('returns null for blank or invalid input so stalls stay unplaced', () => {
    expect(clampStallPosition('')).toBeNull();
    expect(clampStallPosition(null)).toBeNull();
    expect(clampStallPosition(undefined)).toBeNull();
    expect(clampStallPosition('not a number')).toBeNull();
  });

  it('clamps to the 0-100 percentage range the schema enforces', () => {
    expect(clampStallPosition('-5')).toBe(0);
    expect(clampStallPosition('42.5')).toBe(42.5);
    expect(clampStallPosition(150)).toBe(100);
    expect(clampStallPosition(0)).toBe(0);
  });
});
