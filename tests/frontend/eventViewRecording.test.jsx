import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Where a view is counted: the hook, and the pop-up on the events list. The
// event page uses the same hook (pages/EventDetailPage.jsx).

const record = vi.hoisted(() => vi.fn());
vi.mock('@/lib/eventViews.js', () => ({ recordEventView: (...a) => record(...a) }));
vi.mock('@/components/EventRsvp.jsx', () => ({ default: () => null }));
vi.mock('@/hooks/useEventOrganisers.js', () => ({
  useEventOrganisers: () => ({ organisers: [], saveOrganiser: vi.fn(), reload: vi.fn() }),
}));

import { useRecordEventView } from '@/hooks/useRecordEventView.js';
import EventDetailModal from '@/components/EventDetailModal.jsx';

const ID = '11111111-1111-4111-8111-111111111111';
const event = {
  id: ID, title: 'Test Card Show', name: 'Test Card Show', type: 'Card Show',
  image: 'https://example.com/p.jpg', description: 'x', date: 'October 1, 2020', time: '10:00 AM',
  location: 'Sydney, NSW', start_date: '2020-10-01', end_date: '2020-10-01',
};

beforeEach(() => record.mockReset());

describe('useRecordEventView', () => {
  it('records once when enabled', () => {
    renderHook(() => useRecordEventView(ID, true));
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(ID);
  });

  it('does nothing while disabled or without an id', () => {
    renderHook(() => useRecordEventView(ID, false));
    renderHook(() => useRecordEventView(undefined, true));
    expect(record).not.toHaveBeenCalled();
  });

  it('records again for a different event, but not on a plain re-render', () => {
    const { rerender } = renderHook(({ id }) => useRecordEventView(id, true), { initialProps: { id: ID } });
    rerender({ id: ID });
    expect(record).toHaveBeenCalledTimes(1);
    rerender({ id: '22222222-2222-4222-8222-222222222222' });
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('starts counting when it becomes enabled (the event finishes loading)', () => {
    const { rerender } = renderHook(({ on }) => useRecordEventView(ID, on), { initialProps: { on: false } });
    expect(record).not.toHaveBeenCalled();
    rerender({ on: true });
    expect(record).toHaveBeenCalledTimes(1);
  });
});

describe('EventDetailModal', () => {
  const renderModal = (isOpen, ev = event) => render(
    <MemoryRouter><EventDetailModal isOpen={isOpen} onClose={() => {}} event={ev} /></MemoryRouter>,
  );

  it('counts a view when the pop-up opens on an event', () => {
    renderModal(true);
    expect(record).toHaveBeenCalledWith(ID);
  });

  it('does not count while closed or with no event selected', () => {
    renderModal(false);
    renderModal(true, null);
    expect(record).not.toHaveBeenCalled();
  });
});
