import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockFetch }, default: { fetch: mockFetch } }));
vi.mock('react-helmet', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({ default: ({ title, children }) => <div><h1>{title}</h1>{children}</div> }));

import { toast } from 'sonner';
import DisputesAdminPage from '@/pages/admin/DisputesAdminPage.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const DISPUTES = [
  { id: 'd1', amount_aud: 250, reason: 'fraudulent', order_id: 'o1234567', status: 'needs_response', created_at: '2026-06-20T00:00:00Z' },
];
const json = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue(json({ disputes: DISPUTES }));
});

describe('DisputesAdminPage', () => {
  it('loads disputes via the backend and shows them', async () => {
    render(<DisputesAdminPage />);
    expect(await screen.findByText(/fraudulent/i)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/admin/disputes?status=open');
  });

  it('releases a payout via PATCH with action=release', async () => {
    const user = userEvent.setup();
    render(<DisputesAdminPage />);
    await screen.findByText(/fraudulent/i);

    await user.click(screen.getByRole('button', { name: /^release$/i }));
    const dialog = await screen.findByRole('dialog');

    mockFetch.mockResolvedValueOnce(json({ success: true }));
    await user.click(within(dialog).getByRole('button', { name: /release payout/i }));

    await waitFor(() => {
      const patch = mockFetch.mock.calls.find(([, o]) => o?.method === 'PATCH');
      expect(patch).toBeTruthy();
      expect(patch[0]).toBe('/admin/disputes/d1');
      expect(JSON.parse(patch[1].body)).toMatchObject({ action: 'release' });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('keeps a payout frozen via PATCH with action=keep_frozen', async () => {
    const user = userEvent.setup();
    render(<DisputesAdminPage />);
    await screen.findByText(/fraudulent/i);

    await user.click(screen.getByRole('button', { name: /keep frozen/i }));
    const dialog = await screen.findByRole('dialog');
    mockFetch.mockResolvedValueOnce(json({ success: true }));
    await user.click(within(dialog).getByRole('button', { name: /keep frozen/i }));

    await waitFor(() => {
      const patch = mockFetch.mock.calls.find(([, o]) => o?.method === 'PATCH');
      expect(JSON.parse(patch[1].body)).toMatchObject({ action: 'keep_frozen' });
    });
  });
});
