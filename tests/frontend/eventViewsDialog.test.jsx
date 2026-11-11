import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const fetchSeries = vi.hoisted(() => vi.fn());
vi.mock('@/lib/eventViews.js', () => ({ fetchEventViewSeries: (...a) => fetchSeries(...a) }));

import EventViewsDialog from '@/components/events/EventViewsDialog.jsx';

const event = { id: 'e1', title: 'Oz Comic-Con' };
const make = (views) => views.map((v, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, views: v }));

beforeEach(() => fetchSeries.mockReset());

describe('EventViewsDialog', () => {
  it('draws a bar per day with an accessible summary and per-day titles', async () => {
    fetchSeries.mockResolvedValue(make([0, 3, 12, 0, 1]));
    render(<EventViewsDialog event={event} open onOpenChange={() => {}} />);
    expect(await screen.findByTestId('views-summary')).toHaveTextContent(/^16 views in the last 5 days; busiest day \w{3},? 3 Nov with 12\.$/);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('16 views'));
    expect(chart.querySelectorAll('rect')).toHaveLength(5);
    expect(chart.querySelector('rect title')).toHaveTextContent(/^\w{3},? 1 Nov: 0 views$/);
    expect(fetchSeries).toHaveBeenCalledWith('e1', 30);
  });

  it('labels the first and last day and a scale that tops out above the busiest day', async () => {
    fetchSeries.mockResolvedValue(make([0, 3, 12, 0, 1]));
    render(<EventViewsDialog event={event} open onOpenChange={() => {}} />);
    await screen.findByRole('img');
    const chart = screen.getByRole('img');
    expect(chart).toHaveTextContent('1 Nov');
    expect(chart).toHaveTextContent('5 Nov');
    expect(chart).toHaveTextContent('20');   // niceMax(12)
  });

  it('shows a message rather than an empty chart when nobody visited', async () => {
    fetchSeries.mockResolvedValue(make([0, 0, 0]));
    render(<EventViewsDialog event={event} open onOpenChange={() => {}} />);
    expect(await screen.findByText(/Nobody has opened this page/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('says so when the views can’t be loaded', async () => {
    fetchSeries.mockResolvedValue([]);
    render(<EventViewsDialog event={event} open onOpenChange={() => {}} />);
    expect(await screen.findByText(/couldn’t load your views/)).toBeInTheDocument();
  });

  it('does not fetch while closed', () => {
    render(<EventViewsDialog event={event} open={false} onOpenChange={() => {}} />);
    expect(fetchSeries).not.toHaveBeenCalled();
  });
});
