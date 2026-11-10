import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockLoad = vi.hoisted(() => vi.fn());
const mockMark = vi.hoisted(() => vi.fn());
vi.mock('@/lib/eventReviewApi.js', () => ({ loadEventChangeLog: mockLoad, markEventChangesReviewed: mockMark }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import EventChangeLogDialog from '@/components/admin/EventChangeLogDialog.jsx';

const event = { id: 'evt-1', title: 'CollectFest Sydney', slug: 'collectfest-sydney' };
const entries = [
  {
    id: 'log-2', event_id: 'evt-1', created_at: '2026-11-10T02:00:00Z', reviewed_at: null, changed_by_name: 'Bec',
    changes: { start_time: { from: '10:00:00', to: '09:30:00' }, discount_code: { from: 'CARDPOP10', to: 'CARDPOP15' } },
  },
  {
    id: 'log-1', event_id: 'evt-1', created_at: '2026-11-09T02:00:00Z', reviewed_at: '2026-11-09T03:00:00Z', changed_by_name: 'Bec',
    changes: { venue_name: { from: 'Old Hall', to: 'Showgrounds' } },
  },
];

const renderDialog = (props = {}) => render(
  <MemoryRouter><EventChangeLogDialog event={event} onClose={() => {}} {...props} /></MemoryRouter>,
);

describe('EventChangeLogDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); mockLoad.mockResolvedValue(entries); });

  it('shows every changed field before → after, per save', async () => {
    renderDialog();
    expect(await screen.findByText('Start time')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('09:30')).toBeTruthy();
    expect(screen.getByText('Member ticket code')).toBeTruthy();
    expect(screen.getByText('CARDPOP15')).toBeTruthy();
    expect(screen.getByText('Showgrounds')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Reviewed')).toBeTruthy();
  });

  it('marks the unreviewed edits reviewed', async () => {
    mockMark.mockResolvedValue();
    const onReviewed = vi.fn();
    renderDialog({ onReviewed });
    fireEvent.click(await screen.findByRole('button', { name: /Mark 1 as reviewed/ }));
    await waitFor(() => expect(onReviewed).toHaveBeenCalledWith('evt-1'));
    expect(mockMark).toHaveBeenCalledWith('evt-1');
  });
});
