
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, MoreHorizontal, Eye, RefreshCcw, ShoppingCart, ChevronLeft, AlertCircle, Download, RotateCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_BADGE = {
  payment_confirmed: 'bg-blue-500/10 text-blue-700 border-blue-200',
  shipped:           'bg-amber-500/10 text-amber-700 border-amber-200',
  completed:         'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  refunded:          'bg-violet-500/10 text-violet-700 border-violet-200',
  payment_failed:    'bg-destructive/10 text-destructive border-destructive/20',
  cancelled:         'bg-muted text-muted-foreground border-border',
};

const REFUND_BADGE = {
  requested: { label: 'Refund Req.', cls: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  // refunds.status starts at 'pending' (orders.refund_status uses 'requested');
  // include it so the refund dialog's status badge renders styled, not raw text.
  pending:   { label: 'Pending Review', cls: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  approved:  { label: 'Refund Appr.', cls: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  processed: { label: 'Refunded',     cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Req. Rejected', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
};

// ─── Refund Detail Dialog (admin) ─────────────────────────────────────────────

const RefundDetailDialog = ({ order, refund, onClose, onUpdate }) => {
  const [adminNotes, setAdminNotes] = useState(refund?.admin_notes || '');
  const [rejectionReason, setRejectionReason] = useState('');
  const [action, setAction] = useState(null); // 'approve' | 'reject' | 'process'
  const [saving, setSaving] = useState(false);

  const retentionPct = 50;
  const totalFee     = (refund?.commission_aud || 0) + (refund?.gst_aud || 0);
  const retainedFee  = Math.round(totalFee * (retentionPct / 100) * 100) / 100;
  const refundAmount = Math.round(((refund?.total_paid_aud || 0) - retainedFee) * 100) / 100;

  // Refund decisions are privileged: a direct client update would let a user
  // self-approve their own refund. Route through the admin-checked backend
  // endpoint, which re-computes the amount and notifies the buyer server-side.
  const decideRefund = async (body) => {
    const res = await apiClient.fetch(`/admin/refunds/${refund.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Refund update failed');
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await decideRefund({ action: 'approve', admin_notes: adminNotes });
      toast.success('Refund approved');
      onUpdate();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setSaving(true);
    try {
      await decideRefund({ action: 'reject', admin_notes: adminNotes, rejection_reason: rejectionReason });
      toast.success('Refund request rejected');
      onUpdate();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    setSaving(true);
    try {
      const res = await apiClient.fetch('/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundId: refund.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Refund processing failed');
      }
      toast.success('Stripe refund issued');
      onUpdate();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Refund processing failed');
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold">Refund Request</DialogTitle>
          <DialogDescription>Order {order.order_number || order.id.slice(0,8).toUpperCase()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Financials */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="font-bold">${(refund?.total_paid_aud || 0).toFixed(2)} AUD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee on order</span>
              <span className="font-medium">${((refund?.commission_aud || 0) + (refund?.gst_aud || 0)).toFixed(2)} AUD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retained fee (50%)</span>
              <span className="font-medium text-amber-700">${retainedFee.toFixed(2)} AUD</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <span className="font-semibold text-foreground">Refund to buyer</span>
              <span className="font-bold text-emerald-600">${refundAmount.toFixed(2)} AUD</span>
            </div>
          </div>

          {/* Reason */}
          <div className="text-sm space-y-1">
            <p className="font-semibold text-foreground">Buyer's reason</p>
            <p className="text-muted-foreground bg-muted/30 rounded-xl p-3">{refund?.reason}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="outline" className={REFUND_BADGE[refund?.status]?.cls || ''}>
              {refund?.status}
            </Badge>
          </div>

          {/* Admin notes */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Admin notes (internal)</Label>
            <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className="rounded-xl bg-background border-border resize-none" rows={2} placeholder="Internal notes..." />
          </div>

          {/* Rejection reason field */}
          {action === 'reject' && (
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm text-destructive">Rejection reason (sent to buyer)</Label>
              <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="rounded-xl bg-background border-destructive/40 resize-none" rows={2} placeholder="Explain why the refund was declined..." />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {refund?.status === 'pending' && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAction(action === 'reject' ? null : 'reject')} className="flex-1 rounded-xl font-bold text-destructive border-destructive/40 hover:bg-destructive/5 gap-2">
                <XCircle className="w-4 h-4" /> Reject
              </Button>
              <Button onClick={handleApprove} disabled={saving} className="flex-1 rounded-xl font-bold gap-2">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
            </div>
          )}
          {action === 'reject' && (
            <Button onClick={handleReject} disabled={saving || !rejectionReason.trim()} variant="destructive" className="w-full rounded-xl font-bold">
              Confirm Rejection
            </Button>
          )}
          {refund?.status === 'approved' && (
            <Button onClick={handleProcess} disabled={saving} className="w-full rounded-xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700">
              <RotateCcw className="w-4 h-4" /> Issue Stripe Refund (${refundAmount.toFixed(2)} AUD)
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="w-full rounded-xl font-bold text-muted-foreground">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const OrderManagementPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const isMounted = useRef(true);

  const fetchOrders = useCallback(async () => {
    if (!isMounted.current) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, buyer:profiles!buyer_id(id, display_name, username, email), seller:profiles!seller_id(id, display_name, username)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      if (isMounted.current) setOrders(data ?? []);
    } catch (err) {
      if (isMounted.current) setError(err.message);
      toast.error('Failed to load orders.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchOrders();
    return () => { isMounted.current = false; };
  }, [fetchOrders]);

  const openRefundDialog = async (order) => {
    const { data, error } = await supabase.from('refunds').select('*').eq('order_id', order.id).maybeSingle();
    if (error) {
      // A real read failure (RLS/transient) — don't mislabel it as "no details".
      toast.error('Could not load the refund details. Please try again.');
      return;
    }
    if (!data) {
      // Order is flagged for refund but the refunds row is genuinely missing.
      toast.error('No refund details found for this order.');
      return;
    }
    setSelectedOrder(order);
    setSelectedRefund(data);
  };

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) { toast.error('Failed to update order status.'); return; }
    toast.success(`Order status updated to ${newStatus}`);
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.buyer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.buyer?.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter === 'all')              return true;
    if (statusFilter === 'refund_requested') return o.refund_status === 'requested';
    if (statusFilter === 'refund_approved')  return o.refund_status === 'approved';
    return o.status === statusFilter;
  });

  const fmt = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val || 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Order Management | Admin</title></Helmet>

      <AdminPageHeader
        icon={ShoppingCart}
        title="Order Management"
        subtitle="View and manage platform transactions and refund requests."
      >
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </AdminPageHeader>

      <Card className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order # or buyer..."
              className="pl-9 h-10 rounded-xl bg-background border-border"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px] h-10 rounded-xl bg-background border-border">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="payment_confirmed">Confirmed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refund_requested">⚠ Refund Requested</SelectItem>
              <SelectItem value="refund_approved">✓ Refund Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold">Order #</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Buyer</TableHead>
                <TableHead className="font-semibold">Total</TableHead>
                <TableHead className="font-semibold">Fee</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Refund</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array(8).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>)}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    <AlertCircle className="w-10 h-10 text-destructive mb-3 mx-auto" />
                    <p>Failed to load orders</p>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mb-3 mx-auto opacity-40" />
                    <p>No orders found</p>
                  </TableCell>
                </TableRow>
              ) : filtered.map((order) => (
                <TableRow key={order.id} className={order.refund_status === 'requested' ? 'bg-amber-500/5' : ''}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{order.order_number || order.id.slice(0,8).toUpperCase()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="font-medium">{order.buyer?.display_name || order.buyer?.email || 'Unknown'}</TableCell>
                  <TableCell className="tabular-nums font-medium">{fmt(order.total_aud)}</TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">{fmt(order.platform_fee_aud)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs font-bold ${STATUS_BADGE[order.status] || 'bg-muted text-muted-foreground'}`}>
                      {order.status?.replace(/_/g, ' ') || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.refund_status && REFUND_BADGE[order.refund_status] ? (
                      <Badge variant="outline" className={`text-xs font-bold ${REFUND_BADGE[order.refund_status].cls}`}>
                        {REFUND_BADGE[order.refund_status].label}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'shipped')} className="cursor-pointer gap-2 font-medium">
                          Mark as Shipped
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'completed')} className="cursor-pointer gap-2 font-medium">
                          Mark as Completed
                        </DropdownMenuItem>
                        {order.refund_status && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openRefundDialog(order)} className="cursor-pointer gap-2 font-medium text-amber-700 focus:bg-amber-500/10">
                              <RotateCcw className="w-4 h-4" /> Review Refund Request
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'cancelled')} className="cursor-pointer gap-2 font-medium text-destructive focus:bg-destructive/10">
                          Cancel Order
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selectedOrder && selectedRefund && (
        <RefundDetailDialog
          order={selectedOrder}
          refund={selectedRefund}
          onClose={() => { setSelectedOrder(null); setSelectedRefund(null); }}
          onUpdate={fetchOrders}
        />
      )}
    </div>
  );
};

export default OrderManagementPage;
