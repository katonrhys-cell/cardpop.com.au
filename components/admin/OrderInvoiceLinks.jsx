import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Undo2, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { downloadInvoicePdf, downloadOrderInvoicePdf, invoicesPathForOrder, orderHasInvoice } from '@/utils/invoiceDownload.js';

// The order's tax invoice (and credit note, if refunded) inside the admin order
// dialog: download the PDF or jump to the document in Admin → Invoices.
const OrderInvoiceLinks = ({ order }) => {
  const [docs, setDocs] = useState(null);
  const [busy, setBusy] = useState(null);
  const eligible = orderHasInvoice(order);

  useEffect(() => {
    if (!order?.id || !eligible) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiServerClient.fetch(`/admin/invoices/by-order/${order.id}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!cancelled) setDocs(data.invoices || []);
      } catch {
        if (!cancelled) setDocs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [order?.id, eligible]);

  if (!eligible) {
    return (
      <p className="text-xs text-muted-foreground">A tax invoice is issued automatically once the order is paid.</p>
    );
  }

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (err) { toast.error(err.message || 'Could not build the tax invoice.'); } finally { setBusy(null); }
  };

  // The tax invoice is always offered: if the database missed issuing it, the
  // download route issues it on the spot.
  const list = docs && docs.length ? docs : [{ id: null, kind: 'tax_invoice', number: null, status: 'paid' }];

  return (
    <div className="space-y-2">
      {list.map((d) => {
        const credit = d.kind === 'credit_note';
        return (
          <div key={d.id || d.kind} className="flex items-center justify-between gap-3 bg-muted/30 rounded-xl p-3">
            <div className="min-w-0 flex items-center gap-2">
              {credit ? <Undo2 className="w-4 h-4 text-amber-600 shrink-0" /> : <Receipt className="w-4 h-4 text-primary shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{d.number || (credit ? 'Credit note' : 'Tax invoice')}</p>
                <p className="text-xs text-muted-foreground">{credit ? 'Credit note' : 'Tax invoice'}{d.status === 'void' ? ' · void' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm" variant="outline" className="h-8 rounded-lg gap-1.5"
                disabled={busy === (d.id || d.kind)}
                onClick={() => run(d.id || d.kind, () => (d.id ? downloadInvoicePdf(d.id) : downloadOrderInvoicePdf(order.id, d.kind)))}
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
              {d.id && (
                <Button asChild size="sm" variant="ghost" className="h-8 rounded-lg gap-1.5">
                  <Link to={invoicesPathForOrder(order.id)}><ExternalLink className="w-3.5 h-3.5" /> Open</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderInvoiceLinks;
