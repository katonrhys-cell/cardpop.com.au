import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn() } }));

import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';
import ReportModal from '@/components/ReportModal.jsx';

// Radix Select/Dialog rely on a few DOM APIs happy-dom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: true });
});

const ok = (status = 201) => ({ ok: status < 400, status, json: async () => ({ success: true }) });

describe('ReportModal', () => {
  it('redirects unauthenticated users to login instead of opening', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    const user = userEvent.setup();
    render(<ReportModal targetType="listing" targetId="L1" />);

    await user.click(screen.getByRole('button', { name: /report/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login', expect.anything());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiServerClient.fetch).not.toHaveBeenCalled();
  });

  it('opens for authenticated users and submits a report with the right payload', async () => {
    apiServerClient.fetch.mockResolvedValue(ok(201));
    const user = userEvent.setup();
    render(<ReportModal targetType="listing" targetId="L1" />);

    await user.click(screen.getByRole('button', { name: /report/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Pick a reason from the Radix select (keyboard-open is reliable in happy-dom).
    const reasonTrigger = screen.getByRole('combobox', { name: /reason/i });
    reasonTrigger.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: /counterfeit \/ not authentic/i }));

    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => expect(apiServerClient.fetch).toHaveBeenCalledTimes(1));
    const [url, opts] = apiServerClient.fetch.mock.calls[0];
    expect(url).toBe('/reports');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject({ target_type: 'listing', target_id: 'L1', reason: 'counterfeit' });
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows an info toast when the report is a duplicate (409)', async () => {
    apiServerClient.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({}) });
    const user = userEvent.setup();
    render(<ReportModal targetType="listing" targetId="L1" />);

    await user.click(screen.getByRole('button', { name: /report/i }));
    await screen.findByRole('dialog');
    const reasonTrigger = screen.getByRole('combobox', { name: /reason/i });
    reasonTrigger.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: /scam or fraudulent/i }));
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
  });

  it('disables submit until a reason is chosen', async () => {
    const user = userEvent.setup();
    render(<ReportModal targetType="user" targetId="U2" />);
    await user.click(screen.getByRole('button', { name: /report/i }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: /submit report/i })).toBeDisabled();
  });
});
