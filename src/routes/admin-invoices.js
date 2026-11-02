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
} from '../schemas/invoiceSchemas.js';
import {
  listInvoices, countInvoices, getInvoice, getAccountMapping, issueMissingInvoices,
  recordAccountingSync, exportInvoices, xeroPreview,
} from '../services/invoiceService.js';
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
