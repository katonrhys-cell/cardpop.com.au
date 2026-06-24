import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ updateError: null }));
const mockUpdate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: () => ({
      update: (...a) => { mockUpdate(...a); return { eq: () => Promise.resolve({ error: h.updateError }) }; },
    }),
  },
}));

import { useDragDrop } from '@/hooks/useDragDrop.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.updateError = null;
});

describe('useDragDrop — pure helpers', () => {
  it('validateDropZone allows category drops into category zones only', () => {
    const { result } = renderHook(() => useDragDrop());
    expect(result.current.validateDropZone('category', 'category')).toBe(true);
    expect(result.current.validateDropZone('category', 'category_list')).toBe(true);
    expect(result.current.validateDropZone('category', 'brand')).toBe(false);
    expect(result.current.validateDropZone('unknown', 'category')).toBe(false);
  });

  it('calculateNewOrder reorders items and reassigns order indexes', () => {
    const { result } = renderHook(() => useDragDrop());
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const reordered = result.current.calculateNewOrder(items, 'a', 'c', 'after');
    expect(reordered.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(reordered.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('calculateNewOrder returns the original list for unknown ids', () => {
    const { result } = renderHook(() => useDragDrop());
    const items = [{ id: 'a' }];
    expect(result.current.calculateNewOrder(items, 'x', 'y')).toBe(items);
  });
});

describe('useDragDrop — drag state', () => {
  it('tracks the dragged item on start and clears it on end', () => {
    const { result } = renderHook(() => useDragDrop());
    const evt = {
      stopPropagation: vi.fn(), target: { classList: { add: vi.fn(), remove: vi.fn() } },
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    };

    act(() => { result.current.handleDragStart(evt, { id: 'a' }, 'category'); });
    expect(result.current.isDragging).toBe(true);
    expect(result.current.getDraggedItem()).toMatchObject({ id: 'a', type: 'category' });
    expect(evt.dataTransfer.setData).toHaveBeenCalled();

    act(() => { result.current.handleDragEnd(evt); });
    expect(result.current.isDragging).toBe(false);
    expect(result.current.getDraggedItem()).toBeNull();
  });
});

describe('useDragDrop — persistence', () => {
  it('updateItemParent sets the new parent_id', async () => {
    const { result } = renderHook(() => useDragDrop());
    await act(async () => { await result.current.updateItemParent('category', 'c1', 'p1'); });
    expect(mockUpdate).toHaveBeenCalledWith({ parent_id: 'p1' });
  });

  it('updateItemParent throws on a db error', async () => {
    h.updateError = new Error('update failed');
    const { result } = renderHook(() => useDragDrop());
    await expect(
      act(async () => { await result.current.updateItemParent('category', 'c1', 'p1'); }),
    ).rejects.toThrow('update failed');
  });
});
