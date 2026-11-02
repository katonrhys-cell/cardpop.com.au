// Order invoices — the admin-facing read / export / sync-record layer over
// public.invoices. Issuing is the database's job (trg_orders_issue_invoice →
// issue_invoice_for_order / issue_credit_note_for_order); this module only
// reads documents, exports them and records what the accounting system said.
// See docs/order-invoices.md.

import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getPlatformSettings } from '../utils/platformSettings.js';
import { resolveAccountMapping } from '../utils/invoiceAccounting.js';
import { invoicesToCsv, invoicesToXeroCsv, toXeroDocument } from '../utils/invoiceExport.js';

export const INVOICE_LIST_COLUMNS = [
  'id', 'order_id', 'kind', 'number', 'sequence', 'status', 'invoice_date', 'issued_at', 'due_date',
  'paid_at', 'voided_at', 'credits_invoice_id', 'credited_aud',
  'buyer_id', 'buyer_name', 'buyer_email', 'billing_business_name', 'billing_abn', 'ship_to',
  'currency', 'subtotal_aud', 'shipping_aud', 'commission_aud', 'processing_fee_aud', 'discount_aud',
  'adjustment_aud', 'total_aud', 'gst_aud', 'seller_gst_aud', 'platform_gst_aud', 'lines',
  'stripe_session_id', 'stripe_payment_intent_id', 'payment_method',
  'accounting_provider', 'accounting_invoice_id', 'accounting_number', 'accounting_url',
  'accounting_sync_status', 'accounting_synced_at', 'accounting_sync_error', 'notes',
  'created_at', 'updated_at',
].join(', ');

// The number of the invoice a credit note credits, for the list and exports.
const CREDITS_EMBED = 'credits:invoices!credits_invoice_id(number)';

const flattenCredits = (row) => {
  if (!row) return row;
  const { credits, ...rest } = row;
  return { ...rest, credits_number: credits?.number ?? null };
};

const applyFilters = (query, { kind, status, sync, from, to, q } = {}) => {
  if (kind) query = query.eq('kind', kind);
  if (status) query = query.eq('status', status);
  if (sync) query = query.eq('accounting_sync_status', sync);
  if (from) query = query.gte('invoice_date', from);
  if (to) query = query.lte('invoice_date', to);
  if (q) {
    const term = q.replace(/[%_,()]/g, ' ').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) {
      // A pasted order id (uuid columns can't be pattern-matched).
      query = query.eq('order_id', term);
    } else if (term) {
      // Number, customer, email or business name. PostgREST pattern
      // characters were stripped above so a search can't widen itself.
      query = query.or(
        `number.ilike.%${term}%,buyer_name.ilike.%${term}%,buyer_email.ilike.%${term}%,billing_business_name.ilike.%${term}%`,
      );
    }
  }
  return query;
};

/** Page of invoices (newest first) plus the total matching count. */
export async function listInvoices(filters = {}, { maxLimit = 500 } = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), maxLimit);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  let query = supabase
    .from('invoices')
    .select(`${INVOICE_LIST_COLUMNS}, ${CREDITS_EMBED}`, { count: 'exact' });
  query = applyFilters(query, filters)
    .order('invoice_date', { ascending: false })
    .order('sequence', { ascending: false })
    .range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { invoices: (data || []).map(flattenCredits), total: count ?? (data || []).length, limit, offset };
}

/** Counts for the stat tiles: documents issued, awaiting sync, credit notes. */
export async function countInvoices() {
  const countWhere = async (apply) => {
    const { count, error } = await apply(supabase.from('invoices').select('id', { count: 'exact', head: true }));
    if (error) throw error;
    return count ?? 0;
  };
  const [issued, pendingSync, creditNotes, failedSync] = await Promise.all([
    countWhere((q) => q.eq('kind', 'tax_invoice').neq('status', 'void')),
    countWhere((q) => q.neq('status', 'void').eq('accounting_sync_status', 'pending')),
    countWhere((q) => q.eq('kind', 'credit_note')),
    countWhere((q) => q.eq('accounting_sync_status', 'failed')),
  ]);
  return { issued, pending_sync: pendingSync, credit_notes: creditNotes, failed_sync: failedSync };
}

export async function getInvoice(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`${INVOICE_LIST_COLUMNS}, ${CREDITS_EMBED}, order:orders!order_id(id, status, created_at, payout_status, refund_status)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return flattenCredits(data);
}

/** The kind → Xero account / tax mapping in force (platform_settings over defaults). */
export async function getAccountMapping() {
  const settings = await getPlatformSettings(['invoice_xero_account_codes', 'invoice_xero_tax_types']);
  return resolveAccountMapping(settings);
}

/** Issue documents for any paid order that is missing one. Returns the count. */
export async function issueMissingInvoices() {
  const { data, error } = await supabase.rpc('issue_missing_invoices');
  if (error) throw error;
  return Number(data) || 0;
}

/**
 * Record what the accounting system said about a document — today written by
 * the admin ("mark as synced" with the Xero number), later by the API sync.
 */
export async function recordAccountingSync(id, { status, provider, invoiceId, number, url, error: syncError }) {
  const patch = {
    accounting_sync_status: status,
    accounting_provider: provider === undefined ? 'xero' : provider,
    accounting_invoice_id: invoiceId ?? null,
    accounting_number: number ?? null,
    accounting_url: url ?? null,
    accounting_sync_error: status === 'failed' ? (syncError ?? null) : null,
    accounting_synced_at: status === 'synced' ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', id)
    .select(INVOICE_LIST_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const EXPORT_LIMIT = 5000;

/** CSV text for every invoice matching the filters (register or Xero import). */
export async function exportInvoices(filters = {}, format = 'csv') {
  const { invoices, total } = await listInvoices({ ...filters, limit: EXPORT_LIMIT, offset: 0 }, { maxLimit: EXPORT_LIMIT });
  if (total > invoices.length) {
    logger.warn(`[INVOICES] export truncated to ${invoices.length} of ${total} documents — narrow the date range`);
  }
  if (format === 'xero') {
    const mapping = await getAccountMapping();
    return { text: invoicesToXeroCsv(invoices, mapping), count: invoices.length, total, truncated: total > invoices.length };
  }
  return { text: invoicesToCsv(invoices), count: invoices.length, total, truncated: total > invoices.length };
}

export const xeroPreview = (invoice, mapping) => toXeroDocument(invoice, mapping);
