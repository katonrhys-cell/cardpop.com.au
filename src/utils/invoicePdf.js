// PDF tax invoice / credit note rendered from a public.invoices row.
//
// The invoice row is already a complete snapshot (lines, GST inside each line,
// buyer, payment reference), so this is pure presentation: no database reads,
// no recalculation. pdfkit is dynamic-imported so it stays off the API cold
// start (see tests/backend/outboundTimeouts.test.js for the same rule applied
// to the Anthropic SDK). See docs/order-invoices.md → "PDF tax invoice".

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => `$${num(v).toFixed(2)}`;

// pdfkit's built-in Helvetica is WinAnsi: anything outside Latin-1 (a Japanese
// card name, an emoji) would render as garbage, so swap it for "?" instead.
export const pdfSafe = (value) => String(value ?? '')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/[^\n\t\x20-\x7E -ÿ]/g, '?');

const isCreditNote = (invoice) => invoice?.kind === 'credit_note';

/** Download name, e.g. `CardPop-tax-invoice-INV-000042.pdf`. */
export const invoicePdfFilename = (invoice) => {
  const safe = String(invoice?.number || invoice?.id || 'invoice').replace(/[^A-Za-z0-9._-]/g, '_');
  return `CardPop-${isCreditNote(invoice) ? 'credit-note' : 'tax-invoice'}-${safe}.pdf`;
};

/** `2026-10-05` → `5 Oct 2026` (no locale data needed on the server). */
export const formatInvoiceDate = (isoDate) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ''));
  if (!m) return String(isoDate || '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] || m[2]} ${m[1]}`;
};

/** `51824753556` → `51 824 753 556`; anything else is returned untouched. */
export const formatAbnForPdf = (abn) => {
  const d = String(abn || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : String(abn || '').trim();
};

/** The supplier block, tolerant of a half-filled settings row. */
export const normaliseSupplier = (raw) => {
  const s = raw && typeof raw === 'object' ? raw : {};
  const text = (v) => String(v ?? '').trim();
  return {
    legalName: text(s.legal_name) || 'CardPop',
    abn: formatAbnForPdf(s.abn),
    address: text(s.address),
    email: text(s.email),
    phone: text(s.phone),
    footerNote: text(s.footer_note),
  };
};

const SELLER_SUPPLY_KINDS = new Set(['marketplace_item', 'seller_shipping']);

const BRAND = '#CE1126';
const CHARCOAL = '#2B2B2B';
const GREY = '#6B7280';
const RULE = '#D9DBDF';

/**
 * Render the document to a Buffer.
 * @param {object} invoice  a row from public.invoices (lines, ship_to, …)
 * @param {object} [supplierSetting] the `invoice_supplier_details` setting value
 */
export async function renderInvoicePdf(invoice, supplierSetting) {
  const { default: PDFDocument } = await import('pdfkit');
  const supplier = normaliseSupplier(supplierSetting);
  const credit = isCreditNote(invoice);
  const signed = (v) => (credit && num(v) !== 0 ? `-${money(Math.abs(num(v)))}` : money(v));
  const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
  const shipTo = invoice?.ship_to && typeof invoice.ship_to === 'object' ? invoice.ship_to : {};

  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `${credit ? 'Credit note' : 'Tax invoice'} ${invoice?.number || ''}`.trim(),
      Author: supplier.legalName,
      Subject: `Order ${invoice?.order_id || ''}`,
    },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const T = (s) => pdfSafe(s);

  // ── Header ────────────────────────────────────────────────────────────────
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(26).text(T(credit ? 'CREDIT NOTE' : 'TAX INVOICE'), left, 48);
  doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(11).text(T(invoice?.number || ''), left, doc.y + 2);
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  doc.text(T(`Date: ${formatInvoiceDate(invoice?.invoice_date)}`));
  doc.text(T(`Order: ${invoice?.order_id || ''}`));
  if (credit && invoice?.credits_number) doc.text(T(`Credits tax invoice: ${invoice.credits_number}`));
  const leftBottom = doc.y;

  // Supplier block, right-aligned column.
  const colW = 230;
  const colX = right - colW;
  let y = 48;
  doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(12).text(T(supplier.legalName), colX, y, { width: colW, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  if (supplier.abn) doc.text(T(`ABN ${supplier.abn}`), colX, doc.y, { width: colW, align: 'right' });
  if (supplier.address) doc.text(T(supplier.address), colX, doc.y, { width: colW, align: 'right' });
  if (supplier.email) doc.text(T(supplier.email), colX, doc.y, { width: colW, align: 'right' });
  if (supplier.phone) doc.text(T(supplier.phone), colX, doc.y, { width: colW, align: 'right' });
  y = Math.max(leftBottom, doc.y) + 18;

  doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(RULE).stroke();
  y += 14;

  // ── Bill to / Payment ─────────────────────────────────────────────────────
  const half = (width - 20) / 2;
  const labelAt = (txt, x, yy) => doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8).text(T(txt.toUpperCase()), x, yy, { width: half, characterSpacing: 0.6 });

  labelAt('Bill to', left, y);
  doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(10);
  const billName = invoice?.billing_business_name || invoice?.buyer_name || 'Customer';
  doc.text(T(billName), left, y + 13, { width: half });
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  if (invoice?.billing_business_name && invoice?.buyer_name) doc.text(T(invoice.buyer_name), { width: half });
  if (invoice?.billing_abn) doc.text(T(`ABN ${formatAbnForPdf(invoice.billing_abn)}`), { width: half });
  if (invoice?.buyer_email) doc.text(T(invoice.buyer_email), { width: half });
  const addr = [shipTo.address, shipTo.suburb, shipTo.state, shipTo.postcode].filter(Boolean).join(', ');
  if (addr) doc.text(T(`Delivery: ${addr}`), { width: half });
  const billBottom = doc.y;

  const px = left + half + 20;
  labelAt('Payment', px, y);
  doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(10)
    .text(T(invoice?.status === 'void' ? 'Void' : (credit ? 'Refunded' : 'Paid in full')), px, y + 13, { width: half });
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  doc.text(T(`Method: ${String(invoice?.payment_method || 'card').replace(/_/g, ' ')}`), { width: half });
  if (invoice?.stripe_payment_intent_id) doc.text(T(`Reference: ${invoice.stripe_payment_intent_id}`), { width: half });
  if (invoice?.due_date && !credit) doc.text(T(`Paid ${formatInvoiceDate(invoice.invoice_date)}`), { width: half });
  y = Math.max(billBottom, doc.y) + 20;

  // ── Lines ─────────────────────────────────────────────────────────────────
  const cols = {
    desc: { x: left, w: width - 250 },
    qty: { x: left + width - 250, w: 40 },
    unit: { x: left + width - 210, w: 70 },
    gst: { x: left + width - 140, w: 60 },
    amt: { x: left + width - 80, w: 80 },
  };
  const header = (yy) => {
    doc.rect(left, yy, width, 20).fill('#F3F4F6');
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8);
    doc.text('DESCRIPTION', cols.desc.x + 6, yy + 6, { width: cols.desc.w });
    doc.text('QTY', cols.qty.x, yy + 6, { width: cols.qty.w, align: 'right' });
    doc.text('UNIT', cols.unit.x, yy + 6, { width: cols.unit.w, align: 'right' });
    doc.text('GST', cols.gst.x, yy + 6, { width: cols.gst.w, align: 'right' });
    doc.text('AMOUNT', cols.amt.x, yy + 6, { width: cols.amt.w - 6, align: 'right' });
    return yy + 26;
  };
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 150;
  y = header(y);

  let hasSellerSupply = false;
  lines.forEach((l) => {
    if (SELLER_SUPPLY_KINDS.has(l.kind)) hasSellerSupply = true;
    const desc = T(`${l.description || l.kind || 'Item'}${l.sku ? `  (SKU ${l.sku})` : ''}`);
    doc.font('Helvetica').fontSize(9);
    const h = Math.max(doc.heightOfString(desc, { width: cols.desc.w - 6 }), 11) + 8;
    if (y + h > bottomLimit()) {
      doc.addPage();
      y = header(doc.page.margins.top);
    }
    doc.fillColor(CHARCOAL).text(desc, cols.desc.x + 6, y, { width: cols.desc.w - 6 });
    doc.text(String(l.quantity ?? 1), cols.qty.x, y, { width: cols.qty.w, align: 'right' });
    doc.text(signed(l.unit_amount_aud ?? l.amount_aud), cols.unit.x, y, { width: cols.unit.w, align: 'right' });
    doc.fillColor(GREY).text(signed(l.gst_aud), cols.gst.x, y, { width: cols.gst.w, align: 'right' });
    doc.fillColor(CHARCOAL).font('Helvetica-Bold').text(signed(l.amount_aud), cols.amt.x, y, { width: cols.amt.w - 6, align: 'right' });
    y += h;
    doc.moveTo(left, y - 3).lineTo(right, y - 3).lineWidth(0.5).strokeColor(RULE).stroke();
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  if (y + 90 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y += 8;
  const totalsX = left + width - 240;
  const row = (label, value, { bold = false, big = false } = {}) => {
    doc.fillColor(bold ? CHARCOAL : GREY).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(big ? 12 : 9);
    doc.text(T(label), totalsX, y, { width: 150 });
    doc.fillColor(CHARCOAL).text(T(value), totalsX + 150, y, { width: 84, align: 'right' });
    y += big ? 20 : 14;
  };
  const discount = num(invoice?.discount_aud);
  if (discount) row('Discount included above', signed(discount));
  row(credit ? 'Total credited (AUD)' : 'Total (AUD)', signed(invoice?.total_aud), { bold: true, big: true });
  row('Total includes GST of', signed(invoice?.gst_aud));
  if (num(invoice?.credited_aud) && !credit) row('Credited since', money(invoice.credited_aud));

  // ── Notes ─────────────────────────────────────────────────────────────────
  y += 10;
  doc.font('Helvetica').fontSize(8).fillColor(GREY);
  const notes = [];
  notes.push('All amounts are in Australian dollars and include GST where applicable.');
  if (hasSellerSupply) {
    notes.push("Marketplace cards and seller postage are supplied by the seller; CardPop collects the payment and remits the GST on those items on the seller's behalf.");
  }
  if (credit) notes.push('This credit note reduces the amount payable under the tax invoice it refers to.');
  if (invoice?.notes) notes.push(String(invoice.notes));
  if (supplier.footerNote) notes.push(supplier.footerNote);
  if (!supplier.abn) notes.push('Supplier ABN not yet set - add it under Admin > Invoices > Invoice details before sending this to a customer.');
  notes.forEach((n) => {
    doc.text(T(n), left, y, { width });
    y = doc.y + 4;
  });

  // VOID watermark.
  if (invoice?.status === 'void') {
    doc.save();
    doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.fillColor('#B91C1C').opacity(0.12).font('Helvetica-Bold').fontSize(120)
      .text('VOID', 0, doc.page.height / 2 - 60, { width: doc.page.width, align: 'center' });
    doc.restore();
  }

  doc.end();
  return done;
}
