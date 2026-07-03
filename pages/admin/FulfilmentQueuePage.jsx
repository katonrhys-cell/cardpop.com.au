import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Truck, RefreshCcw, ClipboardCopy, Download, CheckCircle2, XCircle, PackageCheck, AlertCircle, Send, Loader2 } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_META = {
  awaiting_fulfilment:   { label: 'Awaiting Fulfilment', color: 'text-blue-600 border-blue-500/30' },
  ordered_with_supplier: { label: 'Ordered w/ Supplier',  color: 'text-amber-600 border-amber-500/30' },
  shipped:               { label: 'Shipped',              color: 'text-emerald-600 border-emerald-500/30' },
  complete:              { label: 'Complete',             color: 'text-emerald-700 border-emerald-600/30' },
  cancelled:             { label: 'Cancelled',            color: 'text-muted-foreground border-border' },
  refunded:              { label: 'Refunded',             color: 'text-violet-600 border-violet-500/30' },
};

const api = async (path, options = {}) => {
  const res = await apiServerClient.fetch(`/supplies${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// Detail + one-click approve dialog: shows the pre-filled supplier order.
const FulfilmentDialog = ({ fulfilmentId, onClose, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('Australia Post');

  const load = useCallback(() => {
    setLoading(true);
    api(`/admin/fulfilments/${fulfilmentId}`)
      .then(setDetail)
      .catch(e => { toast.error(e.message); onClose(); })
      .finally(() => setLoading(false));
  }, [fulfilmentId, onClose]);

  useEffect(() => { load(); }, [load]);

  const f = detail?.fulfilment;
  const order = detail?.supplierOrder;
  const canApprove = f?.status === 'awaiting_fulfilment';
  const canTrack = ['awaiting_fulfilment', 'ordered_with_supplier'].includes(f?.status);
  const canComplete = f?.status === 'shipped';
  const canCancel = ['awaiting_fulfilment', 'ordered_with_supplier'].includes(f?.status);

  const act = async (fn, successMsg) => {
    setWorking(true);
    try {
      await fn();
      toast.success(successMsg);
      onChanged();
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const handleApprove = () => act(
    () => api(`/admin/fulfilments/${fulfilmentId}/approve`, { method: 'POST', body: JSON.stringify({ sendEmail }) }),
    sendEmail && order?.to ? `Approved — order emailed to ${order.to}` : 'Approved',
  );

  const handleTracking = () => {
    if (!trackingNumber.trim()) { toast.error('Enter a tracking number'); return; }
    act(
      () => api(`/admin/fulfilments/${fulfilmentId}/tracking`, {
        method: 'POST',
        body: JSON.stringify({ trackingNumber: trackingNumber.trim(), trackingCarrier }),
      }),
      'Marked shipped — customer emailed with tracking',
    );
  };

  const handleComplete = () => act(
    () => api(`/admin/fulfilments/${fulfilmentId}/complete`, { method: 'POST' }),
    'Fulfilment complete',
  );

  const handleCancel = () => {
    if (!window.confirm('Cancel this fulfilment? Refund the customer via Order Management if they have paid.')) return;
    act(
      () => api(`/admin/fulfilments/${fulfilmentId}/cancel`, { method: 'POST', body: JSON.stringify({}) }),
      'Fulfilment cancelled',
    );
  };

  const copyText = () => {
    navigator.clipboard.writeText(order?.text || '').then(() => toast.success('Supplier order copied'));
  };

  const downloadCsv = () => {
    const blob = new Blob([order?.csv || ''], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${order?.reference || 'supplier-order'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Supply Fulfilment</DialogTitle>
          <DialogDescription>
            {order?.reference} {f?.supplier?.name ? `— ${f.supplier.name}` : '— no supplier assigned'}
          </DialogDescription>
        </DialogHeader>

        {loading || !f ? (
          <div className="space-y-3 py-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`font-bold ${STATUS_META[f.status]?.color}`}>
                {STATUS_META[f.status]?.label || f.status}
              </Badge>
              {f.tracking_number && (
                <span className="text-xs text-muted-foreground font-mono">{f.tracking_carrier}: {f.tracking_number}</span>
              )}
            </div>

            <div className="bg-muted/30 rounded-xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-foreground mb-1">Items</p>
              {(f.items || []).map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.quantity} x {i.supplier_sku ? `[${i.supplier_sku}] ` : ''}{i.title}</span>
                  {i.cost_price_aud != null && <span className="text-muted-foreground tabular-nums">cost ${Number(i.cost_price_aud).toFixed(2)} ea</span>}
                </div>
              ))}
            </div>

            <div className="bg-muted/30 rounded-xl p-4 text-sm">
              <p className="font-semibold text-foreground mb-1">Deliver to</p>
              <p className="text-muted-foreground">
                {[f.shipping_name, f.shipping_address, [f.shipping_suburb, f.shipping_state, f.shipping_postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Pre-filled supplier order</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={copyText}>
                    <ClipboardCopy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={downloadCsv}>
                    <Download className="w-3.5 h-3.5" /> CSV
                  </Button>
                </div>
              </div>
              <pre className="bg-background border border-border rounded-xl p-4 text-xs whitespace-pre-wrap font-mono max-h-56 overflow-y-auto">
                {order?.text}
              </pre>
            </div>

            {canApprove && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="send-email" checked={sendEmail} onCheckedChange={v => setSendEmail(v === true)} disabled={!order?.to} />
                  <Label htmlFor="send-email" className="text-sm font-medium">
                    {order?.to ? `Email this order to ${order.to}` : 'Supplier has no contact email — send manually'}
                  </Label>
                </div>
                <Button onClick={handleApprove} disabled={working} className="w-full rounded-xl font-bold gap-2">
                  {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Approve &amp; Place Supplier Order
                </Button>
              </div>
            )}

            {canTrack && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <Label className="font-bold text-sm">Record tracking (marks shipped + emails customer)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tracking number"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    className="rounded-xl bg-background font-mono"
                  />
                  <Input
                    placeholder="Carrier"
                    value={trackingCarrier}
                    onChange={e => setTrackingCarrier(e.target.value)}
                    className="rounded-xl bg-background w-44"
                  />
                </div>
                <Button onClick={handleTracking} disabled={working || !trackingNumber.trim()} variant="outline" className="w-full rounded-xl font-bold gap-2">
                  <Truck className="w-4 h-4" /> Mark Shipped
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {canComplete && (
                <Button onClick={handleComplete} disabled={working} variant="outline" className="flex-1 rounded-xl font-bold gap-2">
                  <PackageCheck className="w-4 h-4" /> Mark Complete
                </Button>
              )}
              {canCancel && (
                <Button onClick={handleCancel} disabled={working} variant="outline" className="flex-1 rounded-xl font-bold gap-2 text-destructive hover:bg-destructive/10">
                  <XCircle className="w-4 h-4" /> Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const FulfilmentQueuePage = () => {
  const [fulfilments, setFulfilments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('awaiting_fulfilment');
  const [selectedId, setSelectedId] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const data = await api(`/admin/fulfilments${qs}`);
      setFulfilments(data.fulfilments || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Fulfilment Queue | Admin</title></Helmet>

      <AdminPageHeader
        icon={Truck}
        title="Fulfilment Queue"
        subtitle="Dropship supply orders: approve supplier orders and record tracking."
      >
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={fetchQueue}>
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </AdminPageHeader>

      <Card className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex gap-4 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[240px] h-10 rounded-xl bg-background border-border font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="awaiting_fulfilment">Awaiting Fulfilment</SelectItem>
              <SelectItem value="ordered_with_supplier">Ordered with Supplier</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground font-medium">{fulfilments.length} fulfilment{fulfilments.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="overflow-x-auto relative w-full">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground">Created</TableHead>
                <TableHead className="font-semibold text-foreground">Supplier</TableHead>
                <TableHead className="font-semibold text-foreground">Items</TableHead>
                <TableHead className="font-semibold text-foreground">Ship To</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[110px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 text-destructive mb-2 mx-auto" />
                    <p>{error}</p>
                  </TableCell>
                </TableRow>
              ) : fulfilments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mb-2 mx-auto opacity-40" />
                    <p>Nothing here — the queue is clear.</p>
                  </TableCell>
                </TableRow>
              ) : (
                fulfilments.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(f.created_at), 'dd MMM, h:mm a')}
                    </TableCell>
                    <TableCell className="font-medium">{f.supplier?.name || <span className="text-amber-600 font-semibold">Unassigned</span>}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[260px] truncate">
                      {(f.items || []).map(i => `${i.quantity} x ${i.title}`).join(', ')}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {[f.shipping_suburb, f.shipping_state].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`bg-background font-bold ${STATUS_META[f.status]?.color}`}>
                        {STATUS_META[f.status]?.label || f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="rounded-lg font-bold" onClick={() => setSelectedId(f.id)}>
                        {f.status === 'awaiting_fulfilment' ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selectedId && (
        <FulfilmentDialog
          fulfilmentId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={fetchQueue}
        />
      )}
    </div>
  );
};

export default FulfilmentQueuePage;
