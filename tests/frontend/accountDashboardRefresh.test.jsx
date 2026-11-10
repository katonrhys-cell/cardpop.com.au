import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Account → Dashboard: Refresh Data reports what actually happened, and the
// page refetches quietly when the user returns to the tab (realtime can't see
// a deleted row's owner, so deletes made elsewhere only show up this way).

const state = vi.hoisted(() => ({ reads: { events: 0, vault: 0 }, failEvents: false }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/contexts/PlatformSettingsContext.jsx', () => ({ usePlatformSettings: () => ({ settings: {} }) }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children, actions }) => <div>{actions}{children}</div> }));
vi.mock('@/components/AccountPlanBanner.jsx', () => ({ default: () => null }));
vi.mock('@/components/P2PTradingNotice.jsx', () => ({ default: () => null }));
vi.mock('@/components/SellerTierBadge.jsx', () => ({ default: () => null }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          let result = { data: [], count: 0, error: null };
          if (table === 'events') {
            state.reads.events += 1;
            result = state.failEvents ? { data: null, error: new Error('boom') } : { data: [{ status: 'draft' }], error: null };
          }
          if (table === 'vault_items') state.reads.vault += 1;
          if (table === 'profiles') result = { data: null, error: null };
          return (res, rej) => Promise.resolve(result).then(res, rej);
        }
        return () => b;
      },
    });
    return b;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: (t) => builder(t), rpc: () => builder('rpc'), channel: () => channel, removeChannel: () => {} } };
});

import AccountDashboard from '@/pages/account/AccountDashboard.jsx';

const renderPage = () => render(<MemoryRouter><AccountDashboard /></MemoryRouter>);

beforeEach(() => {
  state.reads = { events: 0, vault: 0 };
  state.failEvents = false;
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('Dashboard refresh', () => {
  it('confirms a refresh only once the data has loaded', async () => {
    renderPage();
    await waitFor(() => expect(state.reads.events).toBe(1));
    const button = screen.getByRole('button', { name: /Refresh Data/ });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Dashboard refreshed'));
    expect(toast.error).not.toHaveBeenCalled();
    expect(state.reads.events).toBe(2);
  });

  it('says so when part of the refresh fails', async () => {
    renderPage();
    const button = screen.getByRole('button', { name: /Refresh Data/ });
    await waitFor(() => expect(button).not.toBeDisabled());
    state.failEvents = true;
    fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('refetches quietly on return to the tab after a while away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPage();
      await waitFor(() => expect(state.reads.events).toBe(1));
      const setVisibility = (v) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      setVisibility('hidden');
      await act(async () => { vi.advanceTimersByTime(20_000); });
      setVisibility('visible');
      await waitFor(() => expect(state.reads.events).toBe(2));
      expect(state.reads.vault).toBeGreaterThanOrEqual(2);
      expect(toast.success).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    }
  });
});
