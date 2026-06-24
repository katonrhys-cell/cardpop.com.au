import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ result: { data: [], error: null } }));
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient.js', () => {
  const chan = { on: vi.fn(() => chan), subscribe: vi.fn(() => chan) };
  const builder = {
    select: vi.fn(() => builder), update: vi.fn((...a) => { mockUpdate(...a); return builder; }),
    eq: vi.fn(() => builder), order: vi.fn(() => builder), limit: vi.fn(() => builder),
    then: (res, rej) => Promise.resolve(h.result).then(res, rej),
    catch: (fn) => Promise.resolve(h.result).catch(fn),
  };
  return { supabase: { from: vi.fn(() => builder), channel: vi.fn(() => chan), removeChannel: vi.fn() } };
});

const authState = vi.hoisted(() => ({ currentUser: { id: 'u1' }, isAuthenticated: true }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => authState }));

import { useNotifications } from '@/hooks/useNotifications.js';

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { data: [], error: null };
  authState.currentUser = { id: 'u1' };
  authState.isAuthenticated = true;
});

describe('useNotifications', () => {
  it('loads notifications and derives the unread count', async () => {
    h.result = { data: [
      { id: 'n1', is_read: false }, { id: 'n2', is_read: true }, { id: 'n3', is_read: false },
    ], error: null };
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.unreadCount).toBe(2);
  });

  it('is empty for an unauthenticated user', async () => {
    authState.isAuthenticated = false;
    authState.currentUser = null;
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markRead flips a single notification and updates the count', async () => {
    h.result = { data: [{ id: 'n1', is_read: false }, { id: 'n2', is_read: false }], error: null };
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(async () => { await result.current.markRead('n1'); });
    expect(result.current.notifications.find((n) => n.id === 'n1').is_read).toBe(true);
    expect(result.current.unreadCount).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_read: true }));
  });

  it('markAllRead clears the unread count', async () => {
    h.result = { data: [{ id: 'n1', is_read: false }, { id: 'n2', is_read: false }], error: null };
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(async () => { await result.current.markAllRead(); });
    expect(result.current.unreadCount).toBe(0);
  });
});
