// Invoice exports: the accountant's CSV register, Xero's sales-invoice CSV
// import and the Xero Accounting API document shape.
//
// Pure functions over invoice rows (public.invoices) so every export is
// unit-tested (tests/backend/invoiceExport.test.js). No date library: the only
// formats needed are ISO (register) and dd/mm/yyyy (Xero, Australian org).
//
// Xero CSV import notes (docs/order-invoices.md has the step-by-step):
//   * one row per LINE, rows of one document share the InvoiceNumber;
//   * UnitAmount is GST-INCLUSIVE here — pick "Tax Inclusive" in the import
//     dialog, which is how CardPop prices everything;
//   * TaxType takes Xero's display name ("GST on Income"), the API takes the
//     code ("OUTPUT") — both come from the same mapping;
//   * a credit note is emitted with negative amounts, which Xero's sales
//     import turns into a credit note.

import { accountCodeFor, taxTypeFor, taxTypeLabel } from './invoiceAccounting.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => num(v).toFixed(2);

/** CSV cell: quote when needed and neutralise spreadsheet formula injection. */
export const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows, columns) => {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [header, ...body].join('\n') + '\n';
};

/** `2026-10-05` → `05/10/2026` (Xero AU import); passes anything else through. */
export const toXeroDate = (isoDate) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(isoDate || '');
};

const lines = (invoice) => (Array.isArray(invoice?.lines) ? invoice.lines : []);
const isCreditNote = (invoice) => invoice?.kind === 'credit_note';
const shipTo = (invoice) => (invoice?.ship_to && typeof invoice.ship_to === 'object' ? invoice.ship_to : {});

// ─── Register CSV (one row per document) ─────────────────────────────────────

export const INVOICE_CSV_COLUMNS = [
  { label: 'Number', key: 'number' },
  { label: 'Type', value: (r) => (isCreditNote(r) ? 'Credit note' : 'Tax invoice') },
  { label: 'Status', key: 'status' },
  { label: 'Date', key: 'invoice_date' },
  { label: 'Order id', key: 'order_id' },
  { label: 'Credits', value: (r) => r.credits_number || '' },
  { label: 'Customer', key: 'buyer_name' },
  { label: 'Email', key: 'buyer_email' },
  { label: 'Business name', key: 'billing_business_name' },
  { label: 'ABN', key: 'billing_abn' },
  { label: 'Items inc GST', value: (r) => money(r.subtotal_aud) },
  { label: 'Shipping inc GST', value: (r) => money(r.shipping_aud) },
  { label: 'Service fee inc GST', value: (r) => money(r.commission_aud) },
  { label: 'Payment processing inc GST', value: (r) => money(r.processing_fee_aud) },
  { label: 'Discount', value: (r) => money(-num(r.discount_aud)) },
  { label: 'Adjustment', value: (r) => money(r.adjustment_aud) },
  { label: 'Total inc GST', value: (r) => money(r.total_aud) },
  { label: 'GST inside total', value: (r) => money(r.gst_aud) },
  { label: 'Seller GST remitted', value: (r) => money(r.seller_gst_aud) },
  { label: 'CardPop GST', value: (r) => money(r.platform_gst_aud) },
  { label: 'Payment method', key: 'payment_method' },
  { label: 'Stripe payment', key: 'stripe_payment_intent_id' },
  { label: 'Accounting status', key: 'accounting_sync_status' },
  { label: 'Accounting number', key: 'accounting_number' },
];

export const invoicesToCsv = (invoices) => toCsv(invoices || [], INVOICE_CSV_COLUMNS);

// ─── Xero sales-invoice CSV import (one row per line) ────────────────────────

export const XERO_CSV_HEADERS = [
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount', 'Discount',
  '*AccountCode', '*TaxType',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
  'Currency', 'BrandingTheme',
];

/** The reference Xero shows beside the number: the order it bills. */
export const xeroReference = (invoice) =>
  isCreditNote(invoice) && invoice.credits_number
    ? `Order ${invoice.order_id} · credits ${invoice.credits_number}`
    : `Order ${invoice.order_id}`;

export const xeroCsvRows = (invoice, mapping) => {
  const sign = isCreditNote(invoice) ? -1 : 1;
  const to = shipTo(invoice);
  return lines(invoice).map((line) => {
    const qty = num(line.quantity) || 1;
    const unit = num(line.unit_amount_aud) || num(line.amount_aud) / qty;
    return [
      invoice.buyer_name || 'Customer',
      invoice.buyer_email || '',
      to.address || '', '', '', '',
      to.suburb || '', to.state || '', to.postcode || '', to.country || 'AU',
      invoice.number,
      xeroReference(invoice),
      toXeroDate(invoice.invoice_date),
      toXeroDate(invoice.due_date || invoice.invoice_date),
      line.sku || '',
      line.description || '',
      String(qty),
      money(sign * unit),
      '',
      accountCodeFor(line.kind, mapping),
      taxTypeLabel(taxTypeFor(line.kind, mapping)),
      '', '', '', '',
      invoice.currency || 'AUD',
      '',
    ];
  });
};

export const invoicesToXeroCsv = (invoices, mapping) => {
  const rows = (invoices || []).filter((i) => i.status !== 'void').flatMap((i) => xeroCsvRows(i, mapping));
  return [XERO_CSV_HEADERS.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';
};

// ─── Xero Accounting API document ────────────────────────────────────────────
// The payload a future API sync would POST to /Invoices (Type ACCREC) or
// /CreditNotes (Type ACCRECCREDIT). Shown as a preview in Admin → Invoices so
// the coding can be checked before any connection exists.

export const toXeroDocument = (invoice, mapping) => {
  const credit = isCreditNote(invoice);
  const to = shipTo(invoice);
  const doc = {
    Type: credit ? 'ACCRECCREDIT' : 'ACCREC',
    Contact: {
      Name: invoice.buyer_name || 'Customer',
      ...(invoice.buyer_email ? { EmailAddress: invoice.buyer_email } : {}),
      ...(invoice.billing_abn ? { TaxNumber: invoice.billing_abn } : {}),
      Addresses: [{
        AddressType: 'POBOX',
        AddressLine1: to.address || '',
        City: to.suburb || '',
        Region: to.state || '',
        PostalCode: to.postcode || '',
        Country: to.country || 'AU',
      }],
    },
    Date: invoice.invoice_date,
    Status: 'AUTHORISED',
    LineAmountTypes: 'Inclusive',
    CurrencyCode: invoice.currency || 'AUD',
    Reference: xeroReference(invoice),
    LineItems: lines(invoice).map((line) => ({
      Description: line.description || '',
      Quantity: num(line.quantity) || 1,
      UnitAmount: num(line.unit_amount_aud) || num(line.amount_aud),
      AccountCode: accountCodeFor(line.kind, mapping),
      TaxType: taxTypeFor(line.kind, mapping),
      ...(line.sku ? { ItemCode: line.sku } : {}),
    })),
  };
  if (credit) {
    doc.CreditNoteNumber = invoice.number;
  } else {
    doc.InvoiceNumber = invoice.number;
    doc.DueDate = invoice.due_date || invoice.invoice_date;
  }
  return doc;
};
