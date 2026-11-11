import { describe, it, expect } from 'vitest';
import {
  renderInvoicePdf, invoicePdfFilename, formatInvoiceDate, formatAbnForPdf, normaliseSupplier, pdfSafe,
} from '../../src/utils/invoicePdf.js';

const INVOICE = {
  id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f', order_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'tax_invoice',
  number: 'INV-000042', status: 'paid', invoice_date: '2026-10-05', buyer_name: 'Ash Buyer', buyer_email: 'ash@example.com',
  ship_to: { address: '1 Collector St', suburb: 'Fitzroy', state: 'VIC', postcode: '3065' }, payment_method: 'card',
  total_aud: 113.5, gst_aud: 10.32,
  lines: [
    { kind: 'marketplace_item', description: 'Charizard Holo リザードン', quantity: 1, unit_amount_aud: 100, amount_aud: 100, gst_aud: 9.09 },
    { kind: 'commission', description: 'Service fee', quantity: 1, unit_amount_aud: 3, amount_aud: 3, gst_aud: 0.27 },
  ],
};

describe('invoicePdf helpers', () => {
  it('names the download after the document type and number', () => {
    expect(invoicePdfFilename(INVOICE)).toBe('CardPop-tax-invoice-INV-000042.pdf');
    expect(invoicePdfFilename({ kind: 'credit_note', number: 'CN-000003' })).toBe('CardPop-credit-note-CN-000003.pdf');
    expect(invoicePdfFilename({ kind: 'tax_invoice', number: '../x y' })).toBe('CardPop-tax-invoice-.._x_y.pdf');
  });

  it('formats dates and ABNs for print', () => {
    expect(formatInvoiceDate('2026-10-05')).toBe('5 Oct 2026');
    expect(formatInvoiceDate(null)).toBe('');
    expect(formatAbnForPdf('51824753556')).toBe('51 824 753 556');
    expect(formatAbnForPdf('not an abn')).toBe('not an abn');
  });

  it('falls back to CardPop with no ABN when the setting is empty', () => {
    expect(normaliseSupplier(undefined)).toMatchObject({ legalName: 'CardPop', abn: '' });
    expect(normaliseSupplier({ legal_name: ' CardPop Pty Ltd ', abn: '51824753556' })).toMatchObject({ legalName: 'CardPop Pty Ltd', abn: '51 824 753 556' });
  });

  it('replaces characters Helvetica cannot print', () => {
    expect(pdfSafe('Pokémon – “Holo” リザードン')).toBe('Pokémon - "Holo" ?????');
  });
});

describe('renderInvoicePdf', () => {
  it('renders a tax invoice, a credit note and a void invoice as real PDFs', async () => {
    const supplier = { legal_name: 'CardPop Pty Ltd', abn: '51824753556' };
    const tax = await renderInvoicePdf(INVOICE, supplier);
    const credit = await renderInvoicePdf({ ...INVOICE, kind: 'credit_note', number: 'CN-000001', credits_number: 'INV-000042' }, supplier);
    const voided = await renderInvoicePdf({ ...INVOICE, status: 'void' }, {});
    for (const pdf of [tax, credit, voided]) {
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(1500);
    }
  });

  it('paginates a long invoice instead of overflowing the page', async () => {
    const many = { ...INVOICE, lines: Array.from({ length: 80 }, (_, i) => ({ kind: 'shop_item', description: `Item ${i}`, quantity: 1, amount_aud: 1, gst_aud: 0.09 })) };
    const pdf = await renderInvoicePdf(many, {});
    const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(pages).toBeGreaterThan(1);
  });
});
