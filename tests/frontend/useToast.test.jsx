import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { reducer } from '@/hooks/use-toast.js';
import { useToast } from '@/hooks/use-toast.js';

const base = () => ({ toasts: [] });

describe('toast reducer', () => {
  it('ADD_TOAST adds a toast (capped at the limit of 1)', () => {
    let state = reducer(base(), { type: 'ADD_TOAST', toast: { id: '1', title: 'A', open: true } });
    expect(state.toasts).toHaveLength(1);
    state = reducer(state, { type: 'ADD_TOAST', toast: { id: '2', title: 'B', open: true } });
    expect(state.toasts).toHaveLength(1);       // limit
    expect(state.toasts[0].id).toBe('2');       // newest first
  });

  it('UPDATE_TOAST merges fields by id', () => {
    const start = { toasts: [{ id: '1', title: 'A', open: true }] };
    const state = reducer(start, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'A2' } });
    expect(state.toasts[0].title).toBe('A2');
    expect(state.toasts[0].open).toBe(true);
  });

  it('DISMISS_TOAST closes a specific toast', () => {
    const start = { toasts: [{ id: '1', open: true }, { id: '2', open: true }] };
    const state = reducer(start, { type: 'DISMISS_TOAST', toastId: '1' });
    expect(state.toasts.find((t) => t.id === '1').open).toBe(false);
    expect(state.toasts.find((t) => t.id === '2').open).toBe(true);
  });

  it('DISMISS_TOAST without an id closes them all', () => {
    const start = { toasts: [{ id: '1', open: true }, { id: '2', open: true }] };
    const state = reducer(start, { type: 'DISMISS_TOAST' });
    expect(state.toasts.every((t) => t.open === false)).toBe(true);
  });

  it('REMOVE_TOAST removes one or, without an id, all', () => {
    const start = { toasts: [{ id: '1' }, { id: '2' }] };
    expect(reducer(start, { type: 'REMOVE_TOAST', toastId: '1' }).toasts).toEqual([{ id: '2' }]);
    expect(reducer(start, { type: 'REMOVE_TOAST', toastId: undefined }).toasts).toEqual([]);
  });
});

describe('useToast', () => {
  it('exposes added toasts and can dismiss them', () => {
    const { result } = renderHook(() => useToast());

    let handle;
    act(() => { handle = result.current.toast({ title: 'Hello' }); });
    const shown = result.current.toasts.find((t) => t.id === handle.id);
    expect(shown).toBeTruthy();
    expect(shown.open).toBe(true);

    act(() => { handle.dismiss(); });
    expect(result.current.toasts.find((t) => t.id === handle.id).open).toBe(false);
  });
});
