import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── supabase mock ──────────────────────────────────────────────────────────────

// Configurable per-table results; the builder resolves to whatever the test set.
const h = vi.hoisted(() => ({ tableData: {} }));

vi.mock('@/lib/supabaseClient.js', () => {
  function builder(table) {
    const result = () => Promise.resolve({ data: h.tableData[table] ?? [], error: null });
    const b = {
      _table: table,
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => result()),
      insert: vi.fn(() => b),
      update: vi.fn(() => b),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      single: vi.fn(() => Promise.resolve({ data: { id: 'new' }, error: null })),
      then: (resolve) => result().then(resolve),
    };
    return b;
  }
  const supabase = { from: vi.fn((t) => builder(t)) };
  return { supabase, default: supabase };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';

const CATS = [
  { id: 'c1', name: 'Pokemon', parent_id: null, category_group: 'tcg' },
  { id: 'c2', name: 'Base Set', parent_id: 'c1', category_group: 'tcg' },
  { id: 'c3', name: 'NBA', parent_id: null, category_group: 'sports' },
];

beforeEach(async () => {
  vi.clearAllMocks();
  h.tableData = { categories: CATS };
  // The hook caches categories at module scope; clear it between tests by
  // forcing a refresh so each test starts from a known state.
  const { result } = renderHook(() => useCategories());
  await act(async () => { await result.current.getCategories(true); });
  vi.clearAllMocks();
});

describe('useCategories — fetching & caching', () => {
  it('returns all active categories', async () => {
    const { result } = renderHook(() => useCategories());
    let cats;
    await act(async () => { cats = await result.current.getCategories(true); });
    expect(cats).toHaveLength(3);
    expect(cats.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(supabase.from).toHaveBeenCalledWith('categories');
  });

  it('serves subsequent reads from cache without re-querying', async () => {
    const { result } = renderHook(() => useCategories());
    await act(async () => { await result.current.getCategories(); });
    expect(supabase.from).not.toHaveBeenCalled(); // cache populated in beforeEach
  });

  it('re-queries when forceRefresh is true', async () => {
    const { result } = renderHook(() => useCategories());
    await act(async () => { await result.current.getCategories(true); });
    expect(supabase.from).toHaveBeenCalledWith('categories');
  });

  it('deduplicates concurrent fetches into a single request', async () => {
    h.tableData = { categories: CATS };
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      // Two concurrent forced fetches should share one in-flight promise.
      await Promise.all([
        result.current.getCategories(true),
        result.current.getCategories(),
      ]);
    });
    const categoryQueries = supabase.from.mock.calls.filter(([t]) => t === 'categories');
    expect(categoryQueries).toHaveLength(1);
  });
});

describe('useCategories — derived selectors', () => {
  it('getRootCategories returns only parent_id === null', async () => {
    const { result } = renderHook(() => useCategories());
    let roots;
    await act(async () => { roots = await result.current.getRootCategories(); });
    expect(roots.map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  it('getCategoriesByGroup filters by category_group', async () => {
    const { result } = renderHook(() => useCategories());
    let tcg;
    await act(async () => { tcg = await result.current.getCategoriesByGroup('tcg'); });
    expect(tcg.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('getFranchisesByCategory returns children of a category', async () => {
    const { result } = renderHook(() => useCategories());
    let children;
    await act(async () => { children = await result.current.getFranchisesByCategory('c1'); });
    expect(children.map((c) => c.id)).toEqual(['c2']);
  });

  it('getFranchisesByCategory returns [] for a missing id', async () => {
    const { result } = renderHook(() => useCategories());
    let children;
    await act(async () => { children = await result.current.getFranchisesByCategory(undefined); });
    expect(children).toEqual([]);
  });

  it('buildNameMap maps ids to names', async () => {
    const { result } = renderHook(() => useCategories());
    let map;
    await act(async () => { map = await result.current.buildNameMap(); });
    expect(map).toEqual({ c1: 'Pokemon', c2: 'Base Set', c3: 'NBA' });
  });
});

describe('useCategories — table-backed selectors', () => {
  it('getManufacturersByFranchise queries the manufacturers table', async () => {
    h.tableData = { manufacturers: [{ id: 'm1', name: 'Topps' }] };
    const { result } = renderHook(() => useCategories());
    let mfrs;
    await act(async () => { mfrs = await result.current.getManufacturersByFranchise('c1'); });
    expect(supabase.from).toHaveBeenCalledWith('manufacturers');
    expect(mfrs).toEqual([{ id: 'm1', name: 'Topps' }]);
  });

  it('table-backed selectors short-circuit to [] without an id', async () => {
    const { result } = renderHook(() => useCategories());
    let teams;
    await act(async () => { teams = await result.current.getTeamsByFranchise(undefined); });
    expect(teams).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalledWith('teams');
  });
});
