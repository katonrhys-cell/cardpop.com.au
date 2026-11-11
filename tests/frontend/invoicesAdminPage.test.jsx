import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockFetch }, default: { fetch: mockFetch } }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({ default: ({ title, subtitle, children }) => <div><h1>{title}</h1><p>{subtitle}</p>{children}</div> }));

import { toast } from 'sonner';
import InvoicesAdminPage from '@/pages/admin/InvoicesAdminPage.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
});

const INVOICES = [
  {
    id: 'i1', order_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'tax_invoice', number: 'INV-000001', status: 'paid',
    invoice_date: '2026-10-05', buyer_name: 'Ash Buyer', buyer_email: 'ash@example.com', total_aud: 207.64, gst_aud: 19.5,
    accounting_sync_status: 'pending', credits_number: null,
  },
  {
    id: 'i2', order_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'credit_note', number: 'CN-000001', status: 'issued',
    invoice_date: '2026-10-20', buyer_name: 'Ash Buyer', buyer_email: 'ash@example.com', total_aud: 103.82, gst_aud: 9.75,
    accounting_sync_status: 'synced', accounting_number: 'CN-0007', credits_number: 'INV-000001',
  },
];
const MAPPING = {
  accountCodes: { marketplace_item: '835', commission: '260' }, taxTypes: { marketplace_item: 'BASEXCLUDED', commission: 'OUTPUT' },
  kinds: [{ kind: 'marketplace_item', label: 'Marketplace card' }, { kind: 'commission', label: 'Service fee' }],
  taxTypeLabels: { OUTPUT: 'GST on Income', BASEXCLUDED: 'BAS Excluded' },
};
const DETAIL = {
  invoice: {
    ...INVOICES[0], due_date: '2026-10-05', payment_method: 'card', stripe_payment_intent_id: 'pi_1',
    ship_to: { address: '1 Collector St', suburb: 'Fitzroy', state: 'VIC', postcode: '3065' },
    seller_gst_aud: 9.82, platform_gst_aud: 0.6,
    lines: [
      { kind: 'marketplace_item', description: 'Charizard Holo', quantity: 1, amount_aud: 100, gst_aud: 9.09 },
      { kind: 'commission', description: 'Service fee', quantity: 1, amount_aud: 3, gst_aud: 0.27 },
    ],
  },
  xero: { Type: 'ACCREC', InvoiceNumber: 'INV-000001' },
};

const json = (body, ok = true, headers = {}) => ({
  ok, status: ok ? 200 : 500, json: async () => body, blob: async () => new Blob(['x']),
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockImplementation(async (url, opts = {}) => {
    if (url === '/admin/invoices/mapping') return json(MAPPING);
    if (url.startsWith('/admin/invoices/export')) return json({}, true, {});
    if (url === '/admin/invoices/supplier') return json({ supplier: { legalName: 'CardPop', abn: '' }, ready: false });
    if (url === '/admin/invoices/i1/pdf') return json({}, true, { 'content-disposition': 'attachment; filename="CardPop-tax-invoice-INV-000001.pdf"' });
    if (url === '/admin/invoices/issue-missing') return json({ issued: 2 });
    if (url === '/admin/invoices/i1') return json(DETAIL);
    if (url.endsWith('/accounting') && opts.method === 'PATCH') return json({ invoice: { ...DETAIL.invoice, accounting_sync_status: 'synced', accounting_number: 'INV-0042' } });
    return json({ invoices: INVOICES, total: 2, counts: { issued: 1, pending_sync: 1, credit_notes: 1, failed_sync: 0 } });
  });
});

const listCalls = () => mockFetch.mock.calls.map(([u]) => u).filter((u) => u === '/admin/invoices' || u.startsWith('/admin/invoices?'));

describe('InvoicesAdminPage — tax invoice PDF and order links', () => {
  it('downloads a document as a PDF from its row and links the order back to Order Management', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    const row = (await screen.findByText('INV-000001')).closest('tr');
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/admin/orders?order=cccccccc-cccc-cccc-cccc-cccccccccccc');
    await user.click(within(row).getByRole('button', { name: /download INV-000001 as PDF/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/admin/invoices/i1/pdf'));
  });

  it('warns until the supplier ABN is set', async () => {
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    expect(await screen.findByText(/ABN isn.t set/)).toBeInTheDocument();
  });

  it('opens on one order\'s documents when linked from Order Management', async () => {
    render(<MemoryRouter initialEntries={['/admin/invoices?order=cccccccc-cccc-4ccc-8ccc-cccccccccccc']}><InvoicesAdminPage /></MemoryRouter>);
    await screen.findByText('INV-000001');
    expect(listCalls()[0]).toBe('/admin/invoices?q=cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });
});

describe('InvoicesAdminPage', () => {
  it('lists every document with its number, customer, totals and Xero state', async () => {
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    expect(await screen.findByText('INV-000001')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/admin/invoices');
    const row = screen.getByText('INV-000001').closest('tr');
    expect(row).toHaveTextContent('Tax invoice');
    expect(row).toHaveTextContent('Ash Buyer');
    expect(row).toHaveTextContent('$207.64');
    expect(row).toHaveTextContent('Not in Xero');
    const cn = screen.getByText('CN-000001').closest('tr');
    expect(cn).toHaveTextContent('Credit note · credits INV-000001');
    expect(cn).toHaveTextContent('−$103.82');
    expect(cn).toHaveTextContent('In Xero');
    expect(cn).toHaveTextContent('CN-0007');
    expect(screen.getByText('1 tax invoice · 1 not yet in Xero')).toBeInTheDocument();
  });

  it('refetches with the chosen filters and search', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    await screen.findByText('INV-000001');
    await user.type(screen.getByLabelText('Search invoices'), 'ash');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(listCalls().at(-1)).toBe('/admin/invoices?q=ash'));
    await user.click(screen.getByLabelText('Filter by document type'));
    await user.click(await screen.findByRole('option', { name: 'Credit notes' }));
    await waitFor(() => expect(listCalls().at(-1)).toBe('/admin/invoices?kind=credit_note&q=ash'));
  });

  it('downloads the Xero import with the current filters', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    await screen.findByText('INV-000001');
    await user.click(screen.getByRole('button', { name: /Export for Xero/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/admin/invoices/export?format=xero'));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Xero import file downloaded');
  });

  it('issues missing documents and reloads', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    await screen.findByText('INV-000001');
    const before = listCalls().length;
    await user.click(screen.getByRole('button', { name: /Issue missing/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/admin/invoices/issue-missing', { method: 'POST' }));
    expect(toast.success).toHaveBeenCalledWith('Issued 2 documents');
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
  });

  it('opens a document with its lines coded for Xero and records the Xero link', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'INV-000001' }));
    expect(await screen.findByText('Charizard Holo')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Marketplace card');
    expect(dialog).toHaveTextContent('835');
    expect(dialog).toHaveTextContent('BAS Excluded');
    expect(dialog).toHaveTextContent('GST on Income');
    expect(dialog).toHaveTextContent('Seller GST remitted $9.82');
    expect(dialog).toHaveTextContent('"Type": "ACCREC"');

    await user.type(screen.getByLabelText('Xero invoice number'), 'INV-0042');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/admin/invoices/i1/accounting', expect.objectContaining({ method: 'PATCH' })));
    const [, opts] = mockFetch.mock.calls.find(([u]) => u === '/admin/invoices/i1/accounting');
    expect(JSON.parse(opts.body)).toEqual({ status: 'synced', number: 'INV-0042', url: null, error: null });
    expect(toast.success).toHaveBeenCalledWith('Xero link recorded');
  });

  it('reports a failed load', async () => {
    mockFetch.mockImplementation(async (url) => (url === '/admin/invoices/mapping' ? json(MAPPING) : json({}, false)));
    render(<MemoryRouter><InvoicesAdminPage /></MemoryRouter>);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load invoices'));
    expect(screen.getByText('No invoices')).toBeInTheDocument();
  });
});
