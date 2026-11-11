// Admin → Invoices: /admin/invoices/*. Mounted inside routes/admin.js, so every
// endpoint here already sits behind authMiddleware + isAdminUser + requireAal2.
//
// The database issues the documents; these routes list, export, preview and
// record the accounting-system link. See docs/order-invoices.md.

import { Router } from 'express';
import logger from '../utils/logger.js';
import { validateRequestBody, validateRequestParams, validateRequestQuery } from '../middleware/validateRequest.js';
import {
  listInvoicesQuerySchema, exportInvoicesQuerySchema, invoiceIdSchema, recordAccountingSyncBodySchema,
  orderIdParamSchema, orderInvoicePdfQuerySchema, supplierDetailsBodySchema,
} from '../schemas/invoiceSchemas.js';
import {
  listInvoices, countInvoices, getInvoice, getAccountMapping, issueMissingInvoices,
  recordAccountingSync, exportInvoices, xeroPreview,
  getInvoicesForOrder, getInvoiceSummariesForOrders, getOrderInvoice, getSupplierDetails, saveSupplierDetails,
  buildInvoicePdf, normaliseSupplier,
} from '../services/invoiceService.js';
import { isValidAbn, normalizeAbn } from '../../utils/abn.js';
import { LINE_KINDS, LINE_KIND_LABELS, XERO_TAX_TYPE_LABELS } from '../utils/invoiceAccounting.js';

const router = Router();

const fail = (res, where, err, message) => {
  logger.error(`[INVOICES] ${where}: ${err?.message || err}`);
  return res.status(500).json({ error: message });
};

// GET /admin/invoices?kind=&status=&sync=&from=&to=&q=&limit=&offset=
router.get('/', validateRequestQuery(listInvoicesQuerySchema), async (req, res) => {
  try {
    const filters = listInvoicesQuerySchema.parse(req.query);
    const [page, counts] = await Promise.all([listInvoices(filters), countInvoices()]);
    res.json({ ...page, counts });
  } catch (err) {
    fail(res, 'list', err, 'Failed to load invoices');
  }
});

// GET /admin/invoices/export?format=csv|xero&… — same filters as the list.
router.get('/export', validateRequestQuery(exportInvoicesQuerySchema), async (req, res) => {
  try {
    const { format = 'csv', ...filters } = exportInvoicesQuerySchema.parse(req.query);
    const { text, count, total, truncated } = await exportInvoices(filters, format);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = format === 'xero' ? `cardpop-xero-sales-import-${stamp}.csv` : `cardpop-invoices-${stamp}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('X-Invoice-Count', String(count));
    res.setHeader('X-Invoice-Total', String(total));
    if (truncated) res.setHeader('X-Invoice-Truncated', 'true');
    res.send(text);
  } catch (err) {
    fail(res, 'export', err, 'Failed to export invoices');
  }
});

// GET /admin/invoices/mapping — the line kind → Xero account / tax coding in force.
router.get('/mapping', async (_req, res) => {
  try {
    const mapping = await getAccountMapping();
    res.json({
      ...mapping,
      kinds: LINE_KINDS.map((kind) => ({ kind, label: LINE_KIND_LABELS[kind] })),
      taxTypeLabels: XERO_TAX_TYPE_LABELS,
    });
  } catch (err) {
    fail(res, 'mapping', err, 'Failed to load the account mapping');
  }
});

// POST /admin/invoices/issue-missing — invoices for paid orders without one,
// credit notes for refunded orders without one.
router.post('/issue-missing', async (_req, res) => {
  try {
    const issued = await issueMissingInvoices();
    logger.info(`[INVOICES] issue-missing by admin ${_req.user?.id || 'n/a'}: ${issued} document(s)`);
    res.json({ issued });
  } catch (err) {
    fail(res, 'issue-missing', err, 'Failed to issue missing invoices');
  }
});

// ─── Order ↔ invoice link, PDF tax invoices, supplier details ────────────────
// Registered before '/:id' so these literal paths are never read as an id.

const sendPdf = (res, { buffer, filename }, inline) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
};

// GET /admin/invoices/supplier — who the PDF says issued the invoice.
router.get('/supplier', async (_req, res) => {
  try {
    const supplier = normaliseSupplier(await getSupplierDetails());
    res.json({ supplier, ready: Boolean(supplier.abn) });
  } catch (err) {
    fail(res, 'supplier', err, 'Failed to load the invoice details');
  }
});

// PUT /admin/invoices/supplier — legal name, ABN, address, footer note.
router.put('/supplier', validateRequestBody(supplierDetailsBodySchema), async (req, res) => {
  try {
    const abn = normalizeAbn(req.body.abn);
    if (abn && !isValidAbn(abn)) return res.status(400).json({ error: 'That ABN is not valid - check the 11 digits.' });
    const saved = await saveSupplierDetails({ ...req.body, abn });
    logger.info(`[INVOICES] supplier details updated by admin ${req.user?.id || 'n/a'}`);
    res.json({ supplier: normaliseSupplier(saved), ready: Boolean(saved.abn) });
  } catch (err) {
    fail(res, 'supplier-save', err, 'Failed to save the invoice details');
  }
});

// POST /admin/invoices/by-orders { orderIds } — which orders already have a
// document, for the Order Management list's invoice column.
router.post('/by-orders', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.orderIds) ? req.body.orderIds.filter((i) => typeof i === 'string') : [];
    const rows = await getInvoiceSummariesForOrders(ids);
    const byOrder = {};
    rows.forEach((r) => {
      byOrder[r.order_id] ||= { number: null, credit_note: null, status: null };
      if (r.kind === 'credit_note') byOrder[r.order_id].credit_note = r.number;
      else { byOrder[r.order_id].number = r.number; byOrder[r.order_id].status = r.status; }
    });
    res.json({ invoices: byOrder });
  } catch (err) {
    fail(res, 'by-orders', err, 'Failed to load order invoices');
  }
});

// GET /admin/invoices/by-order/:orderId — the documents issued for one order.
router.get('/by-order/:orderId', validateRequestParams(orderIdParamSchema), async (req, res) => {
  try {
    res.json({ invoices: await getInvoicesForOrder(req.params.orderId) });
  } catch (err) {
    fail(res, 'by-order', err, 'Failed to load the order invoices');
  }
});

// GET /admin/invoices/by-order/:orderId/pdf?kind=tax_invoice|credit_note
// The CardPop tax invoice for an order, as a PDF download.
router.get('/by-order/:orderId/pdf', validateRequestParams(orderIdParamSchema), validateRequestQuery(orderInvoicePdfQuerySchema), async (req, res) => {
  try {
    const { kind = 'tax_invoice' } = orderInvoicePdfQuerySchema.parse(req.query);
    const invoice = await getOrderInvoice(req.params.orderId, kind);
    if (!invoice) {
      return res.status(404).json({
        error: kind === 'credit_note'
          ? 'This order has no credit note - it has not been refunded.'
          : 'This order has no tax invoice yet - an invoice is issued once the order is paid.',
      });
    }
    sendPdf(res, await buildInvoicePdf(invoice), false);
  } catch (err) {
    fail(res, 'order-pdf', err, 'Failed to build the tax invoice');
  }
});

// GET /admin/invoices/:id — the document plus its Xero payload preview.
router.get('/:id', validateRequestParams(invoiceIdSchema), async (req, res) => {
  try {
    const [invoice, mapping] = await Promise.all([getInvoice(req.params.id), getAccountMapping()]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice, xero: xeroPreview(invoice, mapping) });
  } catch (err) {
    fail(res, 'detail', err, 'Failed to load the invoice');
  }
});

// GET /admin/invoices/:id/pdf — any stored document as a PDF.
router.get('/:id/pdf', validateRequestParams(invoiceIdSchema), async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    sendPdf(res, await buildInvoicePdf(invoice), false);
  } catch (err) {
    fail(res, 'pdf', err, 'Failed to build the tax invoice');
  }
});

// PATCH /admin/invoices/:id/accounting — record the accounting-system link.
router.patch('/:id/accounting', validateRequestParams(invoiceIdSchema), validateRequestBody(recordAccountingSyncBodySchema), async (req, res) => {
  try {
    const invoice = await recordAccountingSync(req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice });
  } catch (err) {
    fail(res, 'accounting', err, 'Failed to update the invoice');
  }
});

export default router;
