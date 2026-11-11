import { apiServerClient } from '@/lib/apiServerClient.js';

// Admin PDF tax invoice downloads. The PDF is built by the admin-gated API
// (src/routes/admin-invoices.js → src/utils/invoicePdf.js), so it goes through
// apiServerClient to carry the bearer token — a plain <a href> would not.
// See docs/order-invoices.md → "PDF tax invoice".

/** Order statuses that have a tax invoice (mirrors trg_orders_issue_invoice). */
export const INVOICED_ORDER_STATUSES = ['payment_confirmed', 'shipped', 'delivered', 'completed', 'disputed', 'refunded'];

export const orderHasInvoice = (order) => INVOICED_ORDER_STATUSES.includes(order?.status);

/** Where Admin → Invoices opens on a given order's documents. */
export const invoicesPathForOrder = (orderId) => `/admin/invoices?order=${encodeURIComponent(orderId)}`;

/** Where Order Management opens on a given order. */
export const orderPathForInvoice = (orderId) => `/admin/orders?order=${encodeURIComponent(orderId)}`;

function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const filenameFrom = (res, fallback) => {
  const m = /filename="?([^";]+)"?/i.exec(res.headers.get('content-disposition') || '');
  return m ? m[1] : fallback;
};

async function download(path, fallbackName) {
  const res = await apiServerClient.fetch(path);
  if (!res.ok) {
    let message = 'Could not build the tax invoice.';
    try { message = (await res.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  saveBlob(filenameFrom(res, fallbackName), await res.blob());
}

/** The tax invoice (or credit note) for an order. Issues it first if it is missing. */
export const downloadOrderInvoicePdf = (orderId, kind = 'tax_invoice') =>
  download(`/admin/invoices/by-order/${orderId}/pdf?kind=${kind}`, 'CardPop-tax-invoice.pdf');

/** A stored invoice or credit note by its own id. */
export const downloadInvoicePdf = (invoiceId) =>
  download(`/admin/invoices/${invoiceId}/pdf`, 'CardPop-tax-invoice.pdf');
