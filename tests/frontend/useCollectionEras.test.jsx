import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ result: { data: [], error: null }, reject: false }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder),
    then: (resolve, reject) => (h.reject ? Promise.reject(new Error('db')) : Promise.resolve(h.result)).then(resolve, reject),
    catch: (fn) => (h.reject ? Promise.reject(new Error('db')) : Promise.resolve(h.result)).catch(fn),
  };
  return { supabase: { from: vi.fn(() => builder) } };
});
vi.mock('@/data/collectionConfigs.js', () => ({
  COLLECTION_CONFIGS: { pokemon: { eras: [{ id: 'static-1', name: 'Vintage' }] } },
}));

import { useCollectionEras } from '@/hooks/useCollectionEras.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { data: [], error: null };
  h.reject = false;
});

describe('useCollectionEras', () => {
  it('returns no eras without a collection slug', () => {
    const { result } = renderHook(() => useCollectionEras(null));
    expect(result.current.eras).toEqual([]);
  });

  it('seeds from the static config immediately', () => {
    const { result } = renderHook(() => useCollectionEras('pokemon'));
    expect(result.current.eras).toEqual([{ id: 'static-1', name: 'Vintage' }]);
  });

  it('replaces static eras with DB rows when present', async () => {
    h.result = { data: [{ id: 'db-1', name: 'Modern' }], error: null };
    const { result } = renderHook(() => useCollectionEras('pokemon'));
    await waitFor(() => expect(result.current.eras).toEqual([{ id: 'db-1', name: 'Modern' }]));
    expect(result.current.loading).toBe(false);
  });

  it('keeps the static eras when the DB returns nothing', async () => {
    h.result = { data: [], error: null };
    const { result } = renderHook(() => useCollectionEras('pokemon'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.eras).toEqual([{ id: 'static-1', name: 'Vintage' }]);
  });

  it('keeps the static eras and clears loading on a DB error', async () => {
    h.reject = true;
    const { result } = renderHook(() => useCollectionEras('pokemon'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.eras).toEqual([{ id: 'static-1', name: 'Vintage' }]);
  });
});
