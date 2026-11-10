import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockFetch } }));
vi.mock('@/components/events/OrganiserReach.jsx', () => ({
  OrganiserReachStrip: () => null,
  useOrganiserStats: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import FeatureEventDialog from '@/components/events/FeatureEventDialog.jsx';
import { todayInAustralia } from '@/utils/featuredPackages.js';

const addDays = (n) => {
  const d = new Date(`${todayInAustralia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ev = (id, title, days) => ({ id, title, status: 'approved', start_date: addDays(days), is_featured: false });
const A = ev('a', 'Show A', 10);
const B = ev('b', 'Show B', 12);
const C = ev('c', 'Show C', 14);
const D = ev('d', 'Show D', 16);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'stop here' }) });
});

describe('FeatureEventDialog 3-event pack', () => {
  it('offers no pack with fewer than three featurable events', () => {
    render(<FeatureEventDialog event={A} featurable={[A, B]} onClose={() => {}} />);
    expect(screen.queryByRole('radio', { name: /3-event pack/ })).toBeNull();
  });

  it('ticks this event and the next two, and pays for the pack', async () => {
    render(<FeatureEventDialog event={A} featurable={[D, C, B, A]} startInPack onClose={() => {}} />);

    expect(screen.getByRole('radio', { name: /3-event pack/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: /Show A/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show B/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show C/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show D/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /^Calendar Spotlight/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pay \$119 and feature 3 events/ }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/events/feature-bundle-checkout');
    expect(JSON.parse(opts.body)).toMatchObject({ package: 'spotlight', eventIds: ['a', 'b', 'c'] });
  });

  it('waits for a third event before it can pay', () => {
    render(<FeatureEventDialog event={A} featurable={[A, B, C]} startInPack onClose={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Show C/ }));
    expect(screen.getByRole('button', { name: /Choose 1 more/ })).toBeDisabled();
  });
});
