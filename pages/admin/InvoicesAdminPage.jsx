import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FileText, RefreshCw, Download, CloudUpload, Receipt, AlertTriangle, CheckCircle, Undo2, Search, FilePlus2,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Admin → Invoices. One tax invoice per paid order and one credit note per
// refunded order, issued by the database (trg_orders_issue_invoice); this page
// reads them through the admin-gated /admin/invoices routes, exports the
// register or Xero's sales-import CSV, and records the matching Xero document
// until an API sync exists. See docs/order-invoices.md.

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => (d ? format(new Date(`${String(d).slice(0, 10)}T00:00:00`), 'dd MMM yyyy') : '—');
const shortId = (id) => (id ? `${String(id).slice(0, 8)}…` : '—');

const KIND_FILTERS = [
  ['all', 'Invoices & credit notes'],
  ['tax_invoice', 'Tax invoices'],
  ['credit_note', 'Credit notes'],
];
const SYNC_FILTERS = [
  ['all', 'Any Xero status'],
  ['pending', 'Not yet in Xero'],
  ['synced', 'In Xero'],
  ['failed', 'Sync failed'],
  ['skipped', 'Skipped'],
];

const STATUS_STYLE = {
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
  issued: 'bg-primary/10 text-primary border-primary/30',
  credited: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
  void: 'bg-muted text-muted-foreground border-border line-through',
};
const SYNC_STYLE = {
  synced: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
  pending: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400',
  skipped: 'bg-muted text-muted-foreground border-border',
};
const SYNC_LABEL = { synced: 'In Xero', pending: 'Not in Xero', failed: 'Sync failed', skipped: 'Skipped' };

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}><Icon className="w-4.5 h-4.5" /></div>
      </div>
      {loading ? <Skeleton className="h-9 w-16" /> : <p className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</p>}
    </CardContent>
  </Card>
);

/** Document detail: lines with their Xero coding, totals, the API preview and the sync record form. */
const InvoiceDialog = ({ invoiceId, mapping, onClose, onUpdated }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ status: 'synced', number: '', url: '', error: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiClient.fetch(`/admin/invoices/${invoiceId}`);
        if (!res.ok) throw new Error('Failed to load invoice');
        const data = await res.json();
        if (cancelled) return;
        setDetail(data);
        const inv = data.invoice;
        setForm({
          status: inv.accounting_sync_status === 'pending' ? 'synced' : inv.accounting_sync_status,
          number: inv.accounting_number || '',
          url: inv.accounting_url || '',
          error: inv.accounting_sync_error || '',
        });
      } catch {
        if (!cancelled) toast.error('Failed to load invoice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        status: form.status,
        number: form.number.trim() || null,
        url: form.url.trim() || null,
        error: form.status === 'failed' ? (form.error.trim() || null) : null,
      };
      const res = await apiClient.fetch(`/admin/invoices/${invoiceId}/accounting`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setDetail((d) => ({ ...d, invoice: { ...d.invoice, ...data.invoice } }));
      toast.success('Xero link recorded');
      onUpdated?.();
    } catch {
      toast.error('Failed to record the Xero link');
    } finally {
      setSaving(false);
    }
  };

  const inv = detail?.invoice;
  const lines = Array.isArray(inv?.lines) ? inv.lines : [];

  return (
    <Dialog open={!!invoiceId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {inv?.kind === 'credit_note' ? <Undo2 className="w-5 h-5 text-amber-600" /> : <Receipt className="w-5 h-5 text-primary" />}
            {inv?.number || 'Invoice'}
          </DialogTitle>
          <DialogDescription>
            {inv ? `${inv.kind === 'credit_note' ? 'Credit note' : 'Tax invoice'} · ${fmtDate(inv.invoice_date)} · order ${inv.order_id}${inv.credits_number ? ` · credits ${inv.credits_number}` : ''}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {loading || !inv ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Bill to</p>
                <p className="font-medium">{inv.buyer_name || 'Customer'}</p>
                {inv.buyer_email && <p className="text-muted-foreground">{inv.buyer_email}</p>}
                {inv.billing_abn && <p className="text-muted-foreground">ABN {inv.billing_abn}</p>}
                {inv.ship_to?.address && (
                  <p className="text-muted-foreground">{[inv.ship_to.address, inv.ship_to.suburb, inv.ship_to.state, inv.ship_to.postcode].filter(Boolean).join(', ')}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Payment</p>
                <p className="font-medium capitalize">{String(inv.payment_method || 'card').replace('_', ' ')}</p>
                {inv.stripe_payment_intent_id && <p className="text-muted-foreground font-mono text-xs">{inv.stripe_payment_intent_id}</p>}
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className={`text-xs font-bold capitalize ${STATUS_STYLE[inv.status] || ''}`}>{inv.status}</Badge>
                  <Badge variant="outline" className={`text-xs font-bold ${SYNC_STYLE[inv.accounting_sync_status] || ''}`}>{SYNC_LABEL[inv.accounting_sync_status] || inv.accounting_sync_status}</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Line</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Qty</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Amount</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">GST</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Xero account</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Tax type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i} className="text-sm">
                      <TableCell>
                        <p className="font-medium">{l.description}</p>
                        <p className="text-xs text-muted-foreground">{mapping?.kinds?.find((k) => k.kind === l.kind)?.label || l.kind}{l.sku ? ` · ${l.sku}` : ''}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.quantity ?? 1}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.amount_aud)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(l.gst_aud)}</TableCell>
                      <TableCell className="font-mono text-xs">{mapping?.accountCodes?.[l.kind] || '—'}</TableCell>
                      <TableCell className="text-xs">{mapping?.taxTypeLabels?.[mapping?.taxTypes?.[l.kind]] || mapping?.taxTypes?.[l.kind] || '—'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/20 hover:bg-muted/20 font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(inv.total_aud)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(inv.gst_aud)}</TableCell>
                    <TableCell colSpan={2} className="text-xs font-normal text-muted-foreground">
                      Seller GST remitted {fmtMoney(inv.seller_gst_aud)} · CardPop GST {fmtMoney(inv.platform_gst_aud)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <details className="rounded-xl border border-border p-4 text-sm">
              <summary className="cursor-pointer font-bold">Xero API payload preview</summary>
              <pre className="mt-3 text-xs bg-muted/40 rounded-lg p-3 overflow-x-auto">{JSON.stringify(detail.xero, null, 2)}</pre>
            </details>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="font-bold text-sm flex items-center gap-2"><CloudUpload className="w-4 h-4" /> Record the Xero document</p>
              <p className="text-xs text-muted-foreground">Until the API connection exists, note the Xero invoice this document was entered or imported as, so nothing is sent twice.</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sync-status" className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger id="sync-status" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="synced">In Xero</SelectItem>
                      <SelectItem value="pending">Not in Xero</SelectItem>
                      <SelectItem value="failed">Sync failed</SelectItem>
                      <SelectItem value="skipped">Skip (not needed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sync-number" className="text-xs">Xero invoice number</Label>
                  <Input id="sync-number" className="h-9" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder="INV-0042" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sync-url" className="text-xs">Xero link</Label>
                  <Input id="sync-url" className="h-9" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://go.xero.com/…" />
                </div>
              </div>
              {form.status === 'failed' && (
                <div className="space-y-1">
                  <Label htmlFor="sync-error" className="text-xs">What went wrong</Label>
                  <Input id="sync-error" className="h-9" value={form.error} onChange={(e) => setForm((f) => ({ ...f, error: e.target.value }))} />
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving} className="rounded-xl">{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const InvoicesAdminPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ issued: 0, pending_sync: 0, credit_notes: 0, failed_sync: 0 });
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [kind, setKind] = useState('all');
  const [sync, setSync] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const fetchRef = useRef(null);

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    if (kind !== 'all') p.set('kind', kind);
    if (sync !== 'all') p.set('sync', sync);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (search.trim()) p.set('q', search.trim());
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [kind, sync, from, to, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch(`/admin/invoices${queryString()}`);
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? (data.invoices ?? []).length);
      setCounts({ issued: 0, pending_sync: 0, credit_notes: 0, failed_sync: 0, ...(data.counts || {}) });
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { fetchRef.current = load; load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    apiClient.fetch('/admin/invoices/mapping')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (!cancelled && m) setMapping(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const exportCsv = async (fmt) => {
    setBusy(fmt);
    try {
      const qs = queryString();
      const res = await apiClient.fetch(`/admin/invoices/export${qs}${qs ? '&' : '?'}format=${fmt}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const stamp = format(new Date(), 'yyyy-MM-dd');
      downloadBlob(fmt === 'xero' ? `cardpop-xero-sales-import-${stamp}.csv` : `cardpop-invoices-${stamp}.csv`, blob);
      if (res.headers.get('x-invoice-truncated') === 'true') toast.warning('Export capped at 5,000 documents — narrow the date range for the rest.');
      else toast.success(fmt === 'xero' ? 'Xero import file downloaded' : 'Invoice register downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setBusy(null);
    }
  };

  const issueMissing = async () => {
    setBusy('issue');
    try {
      const res = await apiClient.fetch('/admin/invoices/issue-missing', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const { issued } = await res.json();
      toast.success(issued ? `Issued ${issued} document${issued === 1 ? '' : 's'}` : 'Every paid order already has its invoice');
      fetchRef.current?.();
    } catch {
      toast.error('Failed to issue missing invoices');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <Helmet><title>Invoices | Admin</title></Helmet>

      <AdminPageHeader
        icon={FileText}
        title="Invoices"
        subtitle={`${counts.issued} tax invoice${counts.issued === 1 ? '' : 's'} · ${counts.pending_sync} not yet in Xero`}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={issueMissing} disabled={!!busy}
            className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <FilePlus2 className="w-4 h-4 mr-2" /> Issue missing
          </Button>
          <Button variant="outline" onClick={() => exportCsv('csv')} disabled={!!busy}
            className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => exportCsv('xero')} disabled={!!busy}
            className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <CloudUpload className="w-4 h-4 mr-2" /> Export for Xero
          </Button>
          <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading}
            className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Receipt} label="Tax invoices" value={counts.issued} accent="bg-primary/10 text-primary" loading={loading} />
        <StatCard icon={CloudUpload} label="Not yet in Xero" value={counts.pending_sync} accent="bg-amber-500/10 text-amber-600" loading={loading} />
        <StatCard icon={Undo2} label="Credit notes" value={counts.credit_notes} accent="bg-muted text-muted-foreground" loading={loading} />
        <StatCard icon={AlertTriangle} label="Sync failed" value={counts.failed_sync} accent={counts.failed_sync ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'} loading={loading} />
      </div>

      <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto_1.4fr_auto]" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label="Filter by document type" className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{KIND_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sync} onValueChange={setSync}>
          <SelectTrigger aria-label="Filter by Xero status" className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{SYNC_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl" />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-xl" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input aria-label="Search invoices" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number, customer, email or order id" className="h-10 rounded-xl pl-9" />
        </div>
        <Button type="submit" variant="outline" className="h-10 rounded-xl">Search</Button>
      </form>

      <Card className="shadow-sm border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-primary/40" /></div>
            <p className="font-bold text-lg mb-1">No invoices</p>
            <p className="text-muted-foreground text-sm">Nothing matches your filters. An invoice is issued the moment an order is paid.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Number</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Date</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Customer</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Order</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider text-right">Total</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider text-right">GST</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Xero</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setOpenId(inv.id)}>
                    <TableCell className="px-6 py-4">
                      <button type="button" className="font-bold text-sm text-foreground hover:text-primary text-left" onClick={(e) => { e.stopPropagation(); setOpenId(inv.id); }}>
                        {inv.number}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {inv.kind === 'credit_note' ? `Credit note${inv.credits_number ? ` · credits ${inv.credits_number}` : ''}` : 'Tax invoice'}
                      </p>
                    </TableCell>
                    <TableCell className="py-4 text-sm tabular-nums">{fmtDate(inv.invoice_date)}</TableCell>
                    <TableCell className="py-4 text-sm">
                      <p className="font-medium">{inv.buyer_name || 'Customer'}</p>
                      {inv.buyer_email && <p className="text-xs text-muted-foreground">{inv.buyer_email}</p>}
                    </TableCell>
                    <TableCell className="py-4 text-xs font-mono text-muted-foreground" title={inv.order_id}>{shortId(inv.order_id)}</TableCell>
                    <TableCell className="py-4 text-right font-bold tabular-nums">{inv.kind === 'credit_note' ? `−${fmtMoney(inv.total_aud)}` : fmtMoney(inv.total_aud)}</TableCell>
                    <TableCell className="py-4 text-right tabular-nums text-muted-foreground">{fmtMoney(inv.gst_aud)}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={`font-bold text-xs capitalize ${STATUS_STYLE[inv.status] || ''}`}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className={`font-bold text-xs ${SYNC_STYLE[inv.accounting_sync_status] || ''}`}>
                        {inv.accounting_sync_status === 'synced' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {SYNC_LABEL[inv.accounting_sync_status] || inv.accounting_sync_status}
                      </Badge>
                      {inv.accounting_number && <p className="text-xs text-muted-foreground mt-1">{inv.accounting_number}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {total > invoices.length && (
              <p className="px-6 py-3 text-xs text-muted-foreground border-t border-border">Showing {invoices.length} of {total} — narrow the filters or export for the full set.</p>
            )}
          </div>
        )}
      </Card>

      {openId && (
        <InvoiceDialog invoiceId={openId} mapping={mapping} onClose={() => setOpenId(null)} onUpdated={() => fetchRef.current?.()} />
      )}
    </div>
  );
};

export default InvoicesAdminPage;
