import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: apiFetch }, default: { fetch: apiFetch } }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({ default: ({ title, children }) => <div><h1>{title}</h1>{children}</div> }));

import PromoCodesAdminPage from '@/pages/admin/PromoCodesAdminPage.jsx';

const CODES = [
  {
    id: 'c1', code: 'SAM-VIP', description: 'Thank-you code', discount_pct: 20, applies_to: 'shop',
    usage_type: 'single_use', max_redemptions: null, once_per_customer: true,
    min_order_aud: null, max_discount_aud: null, starts_at: null, expires_at: '2026-12-31T13:00:00Z',
    issued_to_name: 'Sam Lee', issued_to_email: 'sam@example.com', restrict_to_email: true,
    notes: null, active: true, redeemed_count: 1, total_discount_aud: 12.5,
    last_used_at: '2026-10-01T02:00:00Z', status: 'used_up',
  },
  {
    id: 'c2', code: 'SPRING25', description: null, discount_pct: 25, applies_to: 'all',
    usage_type: 'ongoing', max_redemptions: 100, once_per_customer: true,
    min_order_aud: 50, max_discount_aud: 30, starts_at: null, expires_at: null,
    issued_to_name: null, issued_to_email: null, restrict_to_email: false,
    notes: null, active: true, redeemed_count: 0, total_discount_aud: 0, last_used_at: null, status: 'active',
  },
];

const json = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockImplementation((url, opts) => {
    if (url === '/admin/promo-codes' && !opts) return json({ codes: CODES });
    if (url === '/admin/promo-codes' && opts?.method === 'POST') {
      return json({ code: { ...CODES[1], id: 'c3', code: JSON.parse(opts.body).code } });
    }
    if (url === '/admin/promo-codes/c1/redemptions') {
      return json({ redemptions: [{
        id: 'r1', status: 'redeemed', discount_aud: 12.5, reserved_at: '2026-10-01T01:59:00Z',
        redeemed_at: '2026-10-01T02:00:00Z', buyer: { display_name: 'Sam', email: 'sam@example.com' },
        order: { id: 'abcdef12-0000', total_aud: 62.45, status: 'payment_confirmed' },
      }] });
    }
    return json({});
  });
});

describe('PromoCodesAdminPage', () => {
  it('lists codes with who they were given to, their type and usage', async () => {
    render(<PromoCodesAdminPage />);
    expect(await screen.findByText('SAM-VIP')).toBeInTheDocument();
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('One-off · single use')).toBeInTheDocument();
    expect(screen.getByText('Ongoing · max 100 uses · once per customer')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByText('used up')).toBeInTheDocument();
    expect(screen.getByText('Whole cart')).toBeInTheDocument();
  });

  it('filters by recipient search', async () => {
    const user = userEvent.setup();
    render(<PromoCodesAdminPage />);
    await screen.findByText('SAM-VIP');
    await user.type(screen.getByLabelText('Search promo codes'), 'sam@');
    expect(screen.queryByText('SPRING25')).not.toBeInTheDocument();
    expect(screen.getByText('SAM-VIP')).toBeInTheDocument();
  });

  it('creates a one-off code for a named person', async () => {
    const user = userEvent.setup();
    render(<PromoCodesAdminPage />);
    await screen.findByText('SAM-VIP');
    await user.click(screen.getAllByRole('button', { name: /New code/ })[0]);

    const code = screen.getByLabelText('Code');
    expect(code.value).toMatch(/^CP-[A-Z2-9]{8}$/);
    await user.clear(code);
    await user.type(code, 'alex-bday');
    const pct = screen.getByLabelText('Percentage off');
    await user.clear(pct);
    await user.type(pct, '35');
    await user.type(screen.getByLabelText('Name'), 'Alex');
    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    // happy-dom's native constraint validation is stricter than browsers' on
    // number/datetime inputs, so submit the form directly.
    fireEvent.submit(screen.getByRole('button', { name: 'Create code' }).closest('form'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/admin/promo-codes', expect.objectContaining({ method: 'POST' })));
    const body = JSON.parse(apiFetch.mock.calls.find(([, o]) => o?.method === 'POST')[1].body);
    expect(body).toMatchObject({
      code: 'ALEX-BDAY', discountPct: 35, usageType: 'single_use', appliesTo: 'shop',
      issuedToName: 'Alex', issuedToEmail: 'alex@example.com', maxRedemptions: null,
    });
  });

  it('shows the usage history for a code', async () => {
    const user = userEvent.setup();
    render(<PromoCodesAdminPage />);
    await screen.findByText('SAM-VIP');
    await user.click(screen.getByRole('button', { name: 'Usage history for SAM-VIP' }));
    expect(await screen.findByText('#abcdef12')).toBeInTheDocument();
    expect(screen.getByText('redeemed')).toBeInTheDocument();
  });
});
