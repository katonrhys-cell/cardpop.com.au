import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
// A plain flag (not a vi.fn rejection) for the network-failure case: vitest's own
// bookkeeping of a rejected mock result would surface as an unhandled rejection.
const net = vi.hoisted(() => ({ down: false }));
vi.mock('@/lib/apiServerClient.js', () => ({
  default: { fetch: (...a) => (net.down ? Promise.reject(new Error('offline')) : fetchMock(...a)) },
}));

import EventSearchDialog from '@/components/events/EventSearchDialog.jsx';

const event = { id: 'e1', title: 'Oz Comic-Con' };
const reply = (status, body) => fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => { fetchMock.mockReset(); net.down = false; });

describe('EventSearchDialog', () => {
  it('shows the figures and top searches', async () => {
    reply(200, {
      available: true, startDate: '2026-10-13', endDate: '2026-11-09',
      impressions: 1200, clicks: 42, ctr: 0.035, position: 8.2,
      queries: [{ query: 'oz comic con adelaide', clicks: 30, impressions: 400, position: 3 }],
    });
    render(<EventSearchDialog event={event} open onOpenChange={() => {}} />);
    expect(await screen.findByText('oz comic con adelaide')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('3.5%')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/events/e1/search-performance');
  });

  it('explains a page Google hasn’t shown yet', async () => {
    reply(200, { available: true, startDate: '2026-10-13', endDate: '2026-11-09', impressions: 0, clicks: 0, ctr: 0, position: null, queries: [] });
    render(<EventSearchDialog event={event} open onOpenChange={() => {}} />);
    expect(await screen.findByText(/hasn’t shown this page in results yet/)).toBeInTheDocument();
  });

  it('degrades quietly when Search Console isn’t configured or the call fails', async () => {
    reply(503, { configured: false });
    const { unmount } = render(<EventSearchDialog event={event} open onOpenChange={() => {}} />);
    expect(await screen.findByText(/aren’t available yet/)).toBeInTheDocument();
    unmount();
    net.down = true;
    render(<EventSearchDialog event={event} open onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/couldn’t load Google’s figures/)).toBeInTheDocument());
  });
});
