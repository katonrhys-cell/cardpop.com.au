import { describe, it, expect } from 'vitest';
import {
  resolveAccountMapping, accountCodeFor, taxTypeFor, taxTypeLabel,
  DEFAULT_XERO_ACCOUNT_CODES, DEFAULT_XERO_TAX_TYPES, LINE_KINDS,
} from '../../src/utils/invoiceAccounting.js';
import {
  csvCell, toXeroDate, invoicesToCsv, invoicesToXeroCsv, xeroCsvRows, toXeroDocument, XERO_CSV_HEADERS,
} from '../../src/utils/invoiceExport.js';

const invoice = {
  id: 'inv-1', order_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'tax_invoice', number: 'INV-000001', status: 'paid',
  invoice_date: '2026-10-05', due_date: '2026-10-05', buyer_name: 'Ash, Buyer', buyer_email: 'ash@example.com',
  billing_business_name: null, billing_abn: '51824753556', currency: 'AUD',
  ship_to: { address: '1 Collector St', suburb: 'Fitzroy', state: 'VIC', postcode: '3065', country: 'AU' },
  subtotal_aud: 188, shipping_aud: 18, commission_aud: 3, processing_fee_aud: 3.64, discount_aud: 5, adjustment_aud: 0,
  total_aud: 207.64, gst_aud: 19.5, seller_gst_aud: 9.82, platform_gst_aud: 0.6,
  payment_method: 'card', stripe_payment_intent_id: 'pi_1', accounting_sync_status: 'pending', accounting_number: null,
  lines: [
    { kind: 'shop_item', description: '9-Pocket Binder', quantity: 2, unit_amount_aud: 44, amount_aud: 88, gst_aud: 8, sku: 'POG-BIND-RED' },
    { kind: 'marketplace_item', description: 'Charizard Holo', quantity: 1, unit_amount_aud: 100, amount_aud: 100, gst_aud: 9.09 },
    { kind: 'seller_shipping', description: 'Postage', quantity: 1, unit_amount_aud: 8, amount_aud: 8, gst_aud: 0.73 },
    { kind: 'shop_shipping', description: 'Shipping', quantity: 1, unit_amount_aud: 10, amount_aud: 10, gst_aud: 0.91 },
    { kind: 'commission', description: 'Service fee', quantity: 1, unit_amount_aud: 3, amount_aud: 3, gst_aud: 0.27 },
    { kind: 'processing_fee', description: 'Payment processing', quantity: 1, unit_amount_aud: 3.64, amount_aud: 3.64, gst_aud: 0.33 },
    { kind: 'discount', description: 'Discount', quantity: 1, unit_amount_aud: -5, amount_aud: -5, gst_aud: -0.45 },
  ],
};

const creditNote = {
  ...invoice, id: 'cn-1', kind: 'credit_note', number: 'CN-000001', status: 'issued', credits_number: 'INV-000001',
  total_aud: 103.82, lines: [{ kind: 'shop_item', description: '9-Pocket Binder', quantity: 1, unit_amount_aud: 103.82, amount_aud: 103.82, gst_aud: 9.44 }],
};

describe('invoiceAccounting', () => {
  it('falls back to the Xero AU defaults for every line kind', () => {
    const m = resolveAccountMapping({});
    for (const kind of LINE_KINDS) {
      expect(accountCodeFor(kind, m)).toBe(DEFAULT_XERO_ACCOUNT_CODES[kind]);
      expect(taxTypeFor(kind, m)).toBe(DEFAULT_XERO_TAX_TYPES[kind]);
    }
    // Seller-owned lines are never coded to CardPop's Sales account.
    expect(accountCodeFor('marketplace_item', m)).not.toBe(accountCodeFor('shop_item', m));
    expect(taxTypeFor('marketplace_item', m)).toBe('BASEXCLUDED');
  });

  it('lets platform_settings override codes (object or JSON string), ignoring junk', () => {
    const m = resolveAccountMapping({
      invoice_xero_account_codes: { shop_item: '210', marketplace_item: '  ', bogus_kind: '999', commission: 42 },
      invoice_xero_tax_types: '{"shop_item":"EXEMPTOUTPUT"}',
    });
    expect(accountCodeFor('shop_item', m)).toBe('210');
    expect(accountCodeFor('marketplace_item', m)).toBe(DEFAULT_XERO_ACCOUNT_CODES.marketplace_item); // blank → default
    expect(accountCodeFor('commission', m)).toBe(DEFAULT_XERO_ACCOUNT_CODES.commission);               // non-string → default
    expect(m.accountCodes.bogus_kind).toBeUndefined();
    expect(taxTypeFor('shop_item', m)).toBe('EXEMPTOUTPUT');
    expect(taxTypeLabel('EXEMPTOUTPUT')).toBe('GST Free Income');
  });

  it('survives an unparseable setting', () => {
    expect(resolveAccountMapping({ invoice_xero_account_codes: '{not json' }).accountCodes).toEqual(DEFAULT_XERO_ACCOUNT_CODES);
  });
});

describe('invoiceExport helpers', () => {
  it('quotes commas and neutralises formula injection in CSV cells', () => {
    expect(csvCell('Ash, Buyer')).toBe('"Ash, Buyer"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5.00')).toBe('-5.00');
    expect(csvCell(null)).toBe('');
  });

  it('formats dates the way an Australian Xero org imports them', () => {
    expect(toXeroDate('2026-10-05')).toBe('05/10/2026');
    expect(toXeroDate('2026-10-05T03:00:00Z')).toBe('05/10/2026');
    expect(toXeroDate(null)).toBe('');
  });
});

describe('invoicesToCsv (register)', () => {
  it('writes one row per document with the header totals', () => {
    const csv = invoicesToCsv([invoice, creditNote]);
    const rows = csv.trim().split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Number,Type,Status,Date,Order id,Credits,Customer');
    expect(rows[1]).toContain('INV-000001,Tax invoice,paid,2026-10-05,cccccccc-cccc-cccc-cccc-cccccccccccc,,"Ash, Buyer",ash@example.com');
    expect(rows[1]).toContain(',207.64,19.50,9.82,0.60,card,pi_1,pending,');
    expect(rows[1]).toContain(',-5.00,0.00,');
    expect(rows[2]).toContain('CN-000001,Credit note,issued,2026-10-05,cccccccc-cccc-cccc-cccc-cccccccccccc,INV-000001');
  });
});

describe('invoicesToXeroCsv (Xero sales import)', () => {
  const mapping = resolveAccountMapping({});

  it('emits Xero\'s template header and one row per line', () => {
    const csv = invoicesToXeroCsv([invoice], mapping);
    const rows = csv.trim().split('\n');
    expect(rows[0]).toBe(XERO_CSV_HEADERS.join(','));
    expect(rows[0].startsWith('*ContactName,EmailAddress,')).toBe(true);
    expect(rows).toHaveLength(1 + invoice.lines.length);
  });

  it('codes each line by kind, GST-inclusive, with the display tax type', () => {
    const rows = xeroCsvRows(invoice, mapping);
    const byDesc = Object.fromEntries(rows.map((r) => [r[15], r]));
    const col = (name) => XERO_CSV_HEADERS.indexOf(name);

    const binder = byDesc['9-Pocket Binder'];
    expect(binder[col('*ContactName')]).toBe('Ash, Buyer');
    expect(binder[col('EmailAddress')]).toBe('ash@example.com');
    expect(binder[col('POAddressLine1')]).toBe('1 Collector St');
    expect(binder[col('POCity')]).toBe('Fitzroy');
    expect(binder[col('PORegion')]).toBe('VIC');
    expect(binder[col('POPostalCode')]).toBe('3065');
    expect(binder[col('*InvoiceNumber')]).toBe('INV-000001');
    expect(binder[col('Reference')]).toBe('Order cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(binder[col('*InvoiceDate')]).toBe('05/10/2026');
    expect(binder[col('*DueDate')]).toBe('05/10/2026');
    expect(binder[col('InventoryItemCode')]).toBe('POG-BIND-RED');
    expect(binder[col('*Quantity')]).toBe('2');
    expect(binder[col('*UnitAmount')]).toBe('44.00');
    expect(binder[col('*AccountCode')]).toBe('200');
    expect(binder[col('*TaxType')]).toBe('GST on Income');
    expect(binder[col('Currency')]).toBe('AUD');

    const card = byDesc['Charizard Holo'];
    expect(card[col('*AccountCode')]).toBe('835');
    expect(card[col('*TaxType')]).toBe('BAS Excluded');

    expect(byDesc['Discount'][col('*UnitAmount')]).toBe('-5.00');
    expect(byDesc['Service fee'][col('*AccountCode')]).toBe('260');
  });

  it('lines of one invoice sum to its total', () => {
    const rows = xeroCsvRows(invoice, mapping);
    const sum = rows.reduce((s, r) => s + Number(r[16]) * Number(r[17]), 0);
    expect(Math.round(sum * 100) / 100).toBe(207.64);
  });

  it('emits a credit note as negative amounts referencing the invoice it credits', () => {
    const [row] = xeroCsvRows(creditNote, mapping);
    expect(row[XERO_CSV_HEADERS.indexOf('*InvoiceNumber')]).toBe('CN-000001');
    expect(row[XERO_CSV_HEADERS.indexOf('*UnitAmount')]).toBe('-103.82');
    expect(row[XERO_CSV_HEADERS.indexOf('Reference')]).toBe('Order cccccccc-cccc-cccc-cccc-cccccccccccc · credits INV-000001');
  });

  it('leaves voided documents out of the import', () => {
    const csv = invoicesToXeroCsv([{ ...invoice, status: 'void' }], mapping);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });
});

describe('toXeroDocument (API payload)', () => {
  const mapping = resolveAccountMapping({ invoice_xero_account_codes: { marketplace_item: '2200' } });

  it('builds an inclusive ACCREC invoice with coded line items', () => {
    const doc = toXeroDocument(invoice, mapping);
    expect(doc.Type).toBe('ACCREC');
    expect(doc.InvoiceNumber).toBe('INV-000001');
    expect(doc.DueDate).toBe('2026-10-05');
    expect(doc.Status).toBe('AUTHORISED');
    expect(doc.LineAmountTypes).toBe('Inclusive');
    expect(doc.CurrencyCode).toBe('AUD');
    expect(doc.Contact).toMatchObject({ Name: 'Ash, Buyer', EmailAddress: 'ash@example.com', TaxNumber: '51824753556' });
    expect(doc.Contact.Addresses[0]).toMatchObject({ City: 'Fitzroy', Region: 'VIC', PostalCode: '3065', Country: 'AU' });
    expect(doc.LineItems).toHaveLength(7);
    expect(doc.LineItems[0]).toEqual({ Description: '9-Pocket Binder', Quantity: 2, UnitAmount: 44, AccountCode: '200', TaxType: 'OUTPUT', ItemCode: 'POG-BIND-RED' });
    expect(doc.LineItems[1]).toMatchObject({ Description: 'Charizard Holo', AccountCode: '2200', TaxType: 'BASEXCLUDED' });
    expect(doc.LineItems[1].ItemCode).toBeUndefined();
  });

  it('builds an ACCRECCREDIT credit note with its own number and no due date', () => {
    const doc = toXeroDocument(creditNote, mapping);
    expect(doc.Type).toBe('ACCRECCREDIT');
    expect(doc.CreditNoteNumber).toBe('CN-000001');
    expect(doc.InvoiceNumber).toBeUndefined();
    expect(doc.DueDate).toBeUndefined();
    expect(doc.LineItems[0].UnitAmount).toBe(103.82);
  });
});
