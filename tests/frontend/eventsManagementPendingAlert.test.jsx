import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/EventScraperPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventScanPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/admin/EventRsvpListDialog.jsx', () => ({ default: () => null }));
vi.mock('@/lib/eventReviewApi.js', () => ({
  loadUnreviewedChanges: vi.fn(async () => new Map()),
  notifyEventDecision: vi.fn(),
}));

const updateMock = vi.fn();
let fixture = [];
vi.mock('@/lib/supabaseClient.js', () => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: () => ({ order: async () => ({ data: fixture, error: null }) }),
        update: updateMock,
      })),
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

import EventsManagementPage from '@/pages/admin/EventsManagementPage.jsx';

const sectionOf = (title) => {
  // Walk back from the row to the section header row above it.
  let tr = screen.getByText(title).closest('tr');
  while (tr && !tr.dataset.section) tr = tr.previousElementSibling;
  return tr?.dataset.section;
};

describe('EventsManagementPage — pending review alert', () => {
  afterEach(() => { vi.clearAllMocks(); });

  it('alerts at the top and lists the event under Pending review until it is approved', async () => {
    fixture = [
      { id: 'm1', title: 'Member Card Show', status: 'pending_review', auto_discovered: false, start_date: '2099-03-01' },
      { id: 'a1', title: 'Live Expo', status: 'approved', auto_discovered: false, start_date: '2099-02-01' },
    ];
    updateMock.mockReturnValue({ eq: () => ({ select: async () => ({ data: [{ id: 'm1' }], error: null }) }) });
    render(<MemoryRouter><EventsManagementPage /></MemoryRouter>);

    const alert = await screen.findByTestId('pending-review-alert');
    expect(alert).toHaveTextContent('1 event is waiting for your review');
    expect(alert).toHaveTextContent('1 submitted by a member');
    expect(sectionOf('Member Card Show')).toBe('pending');
    expect(sectionOf('Live Expo')).toBe('current');

    fireEvent.click(screen.getByText('Member Card Show').closest('tr').querySelector('[role="switch"]'));

    await waitFor(() => expect(screen.queryByTestId('pending-review-alert')).not.toBeInTheDocument());
    expect(sectionOf('Member Card Show')).toBe('current');
    expect(document.querySelector('[data-section="pending"]')).toBeNull();
  });

  it('shows no alert when nothing is pending', async () => {
    fixture = [{ id: 'a1', title: 'Live Expo', status: 'approved', auto_discovered: false, start_date: '2099-02-01' }];
    render(<MemoryRouter><EventsManagementPage /></MemoryRouter>);
    await screen.findByText('Live Expo');
    expect(screen.queryByTestId('pending-review-alert')).not.toBeInTheDocument();
  });
});
