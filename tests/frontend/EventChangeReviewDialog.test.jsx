import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockApply = vi.hoisted(() => vi.fn());
const mockDismiss = vi.hoisted(() => vi.fn());
vi.mock('@/lib/eventReviewApi.js', () => ({ applyChangeRequest: mockApply, dismissChangeRequest: mockDismiss }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import EventChangeReviewDialog from '@/components/admin/EventChangeReviewDialog.jsx';

const event = { id: 'evt-1', title: 'CollectFest Sydney', start_time: '10:00:00', venue_name: 'Old Hall' };
const request = { id: 'req-1', event_id: 'evt-1', changes: { start_time: '09:30', venue_name: 'Showgrounds' } };

describe('EventChangeReviewDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows each requested field as current → requested', () => {
    render(<EventChangeReviewDialog event={event} request={request} onClose={() => {}} />);
    expect(screen.getByText('Start time')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('09:30')).toBeTruthy();
    expect(screen.getByText('Old Hall')).toBeTruthy();
    expect(screen.getByText('Showgrounds')).toBeTruthy();
  });

  it('applies with the note, then reports the decision', async () => {
    mockApply.mockResolvedValue();
    const onDecided = vi.fn();
    const onClose = vi.fn();
    render(<EventChangeReviewDialog event={event} request={request} onClose={onClose} onDecided={onDecided} />);
    fireEvent.change(screen.getByLabelText(/Note to the organiser/), { target: { value: 'Thanks!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith('evt-1'));
    expect(mockApply).toHaveBeenCalledWith('req-1', 'Thanks!');
    expect(onClose).toHaveBeenCalled();
  });

  it('dismisses without touching the event', async () => {
    mockDismiss.mockResolvedValue();
    render(<EventChangeReviewDialog event={event} request={request} onClose={() => {}} onDecided={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('req-1', ''));
    expect(mockApply).not.toHaveBeenCalled();
  });
});
