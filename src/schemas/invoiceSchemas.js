import { z } from 'zod';

export const INVOICE_KINDS = ['tax_invoice', 'credit_note'];
export const INVOICE_STATUSES = ['issued', 'paid', 'credited', 'void'];
export const INVOICE_SYNC_STATUSES = ['pending', 'synced', 'failed', 'skipped'];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const listInvoicesQuerySchema = z.object({
  kind: z.enum(INVOICE_KINDS).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  sync: z.enum(INVOICE_SYNC_STATUSES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const exportInvoicesQuerySchema = listInvoicesQuerySchema.extend({
  format: z.enum(['csv', 'xero']).optional(),
});

export const invoiceIdSchema = z.object({
  id: z.string().uuid('Invoice id must be a UUID'),
});

export const recordAccountingSyncBodySchema = z.object({
  status: z.enum(INVOICE_SYNC_STATUSES),
  provider: z.string().trim().max(40).optional().nullable(),
  invoiceId: z.string().trim().max(120).optional().nullable(),
  number: z.string().trim().max(120).optional().nullable(),
  url: z.string().trim().url().max(500).optional().nullable(),
  error: z.string().trim().max(1000).optional().nullable(),
});
