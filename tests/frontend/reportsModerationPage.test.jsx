import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({
  apiServerClient: { fetch: mockFetch },
  default: { fetch: mockFetch },
}));
vi.mock('react-helmet', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));

import { toast } from 'sonner';
import ReportsModerationPage from '@/pages/admin/ReportsModerationPage.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const REPORTS = [
  { id: 'r1', target_type: 'listing', target_id: 'L1234567', reason: 'counterfeit', status: 'open', details: 'Fake autograph', created_at: '2026-06-20T00:00:00Z', reporter: { display_name: 'Alice' } },
  { id: 'r2', target_type: 'user', target_id: 'U7654321', reason: 'spam', status: 'open', created_at: '2026-06-21T00:00:00Z', reporter: { username: 'bob' } },
];

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue(jsonRes({ reports: REPORTS }));
});

describe('ReportsModerationPage', () => {
  it('loads reports from the backend and renders them', async () => {
    render(<ReportsModerationPage />);
    expect(await screen.findByText('Counterfeit')).toBeInTheDocument();
    expect(screen.getByText('Spam')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // initial load filters to open reports
    expect(mockFetch).toHaveBeenCalledWith('/reports?status=open');
  });

  it('shows the empty state when there are no reports', async () => {
    mockFetch.mockResolvedValue(jsonRes({ reports: [] }));
    render(<ReportsModerationPage />);
    expect(await screen.findByText(/no reports found/i)).toBeInTheDocument();
  });

  it('triages a report via PATCH with the chosen status', async () => {
    const user = userEvent.setup();
    render(<ReportsModerationPage />);
    await screen.findByText('Counterfeit');

    // Open the triage modal for the first report.
    await user.click(screen.getAllByRole('button', { name: /triage/i })[0]);
    const dialog = await screen.findByRole('dialog');

    // Default decision for an open report is "reviewing"; switch to "Action & Resolve".
    await user.click(within(dialog).getByRole('button', { name: /action & resolve/i }));

    mockFetch.mockResolvedValueOnce(jsonRes({ success: true })); // PATCH response
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      const patchCall = mockFetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall[0]).toBe('/reports/r1');
      expect(JSON.parse(patchCall[1].body)).toMatchObject({ status: 'actioned' });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('surfaces a high-risk indicator for counterfeit/scam reports', async () => {
    render(<ReportsModerationPage />);
    await screen.findByText('Counterfeit');
    // The counterfeit row links the listing target to the marketplace page.
    const link = screen.getByRole('link', { name: /L1234567/i });
    expect(link).toHaveAttribute('href', '/marketplace/L1234567');
  });
});
