import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/EventScraperPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventScanPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/admin/EventRsvpListDialog.jsx', () => ({ default: () => null }));

const updateMock = vi.fn();
vi.mock('@/lib/supabaseClient.js', () => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: () => ({ order: async () => ({ data: fixtureEvents(), error: null }) }),
        update: updateMock,
      })),
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

import { toast } from 'sonner';
import EventsManagementPage, { PUBLISHED_ROW_LINGER_MS } from '@/pages/admin/EventsManagementPage.jsx';

const fixtureEvents = () => [
  { id: 'e1', title: 'Collector Con Penrith', status: 'pending_review', auto_discovered: true, start_date: '2026-09-20' },
  { id: 'e2', title: 'One Piece Brisbane Regional', status: 'pending_review', auto_discovered: true, start_date: '2026-09-05' },
  { id: 'e3', title: 'Hand-made event', status: 'approved', auto_discovered: false, start_date: '2026-08-01' },
];

const mockUpdate = (result) => {
  updateMock.mockReturnValue({ eq: () => ({ select: async () => result }) });
};

const openScanQueue = async () => {
  render(<MemoryRouter><EventsManagementPage /></MemoryRouter>);
  await screen.findByText('Collector Con Penrith');
  fireEvent.click(screen.getByRole('button', { name: /Found by scan \(2\)/ }));
  expect(screen.queryByText('Hand-made event')).not.toBeInTheDocument();
};

const rowOf = (title) => screen.getByText(title).closest('tr');

describe('EventsManagementPage — publishing from the "Found by scan" queue', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('shows the toggle on, then removes the row after it lingers', async () => {
    mockUpdate({ data: [{ id: 'e1' }], error: null });
    await openScanQueue();

    const row = rowOf('Collector Con Penrith');
    const toggle = row.querySelector('[role="switch"]');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(row).toHaveTextContent('Pending');

    fireEvent.click(toggle);

    // Straight after the write the row is still there with the toggle on and
    // no Pending badge — the admin sees the publish land before the row goes.
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Event published.'));
    const lingering = rowOf('Collector Con Penrith');
    expect(lingering).toBeInTheDocument();
    expect(lingering.querySelector('[role="switch"]')).toHaveAttribute('aria-checked', 'true');
    expect(lingering).not.toHaveTextContent('Pending');
    expect(lingering).toHaveAttribute('data-lingering', 'true');
    // The queue count drops immediately, matching the header badge.
    expect(screen.getByRole('button', { name: /Found by scan \(1\)/ })).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(PUBLISHED_ROW_LINGER_MS + 50); });
    expect(screen.queryByText('Collector Con Penrith')).not.toBeInTheDocument();
    expect(screen.getByText('One Piece Brisbane Regional')).toBeInTheDocument();
  });

  it('does not claim success when the update touched no rows', async () => {
    mockUpdate({ data: [], error: null });
    await openScanQueue();

    fireEvent.click(rowOf('Collector Con Penrith').querySelector('[role="switch"]'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update event status.'));
    expect(toast.success).not.toHaveBeenCalled();
    const row = rowOf('Collector Con Penrith');
    expect(row.querySelector('[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    expect(row).toHaveTextContent('Pending');
  });
});
