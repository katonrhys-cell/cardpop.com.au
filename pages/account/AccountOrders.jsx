import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ShoppingBag, RotateCcw, Info, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const REFUND_REASONS = [
  { value: 'item_not_received',      label: 'Item not received' },
  { value: 'item_not_as_described',  label: 'Item not as described' },
  { value: 'damaged',                label: 'Item arrived damaged' },
  { value: 'wrong_item',             label: 'Wrong item sent' },
  { value: 'seller_cancelled',       label: 'Seller cancelled the order' },
  { value: 'other',                  label: 'Other' },
];

const REFUND_WINDOW_DAYS = 30;

const STATUS_CONFIG = {
  payment_confirmed: { label: 'Confirmed',   color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  shipped:           { label: 'Shipped',     color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  completed:         { label: 'Completed',   color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  refunded:          { label: 'Refunded',    color: 'bg-violet-500/10 text-violet-700 border-violet-200' },
  payment_failed:    { label: 'Failed',      color: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled:         { label: 'Cancelled',   color: 'bg-muted text-muted-foreground border-border' },
};

const REFUND_STATUS_CONFIG = {
  requested: { label: 'Refund Requested', Icon: Clock,        color: 'text-amber-600' },
  approved:  { label: 'Refund Approved',  Icon: CheckCircle2, color: 'text-blue-600' },
  processed: { label: 'Refund Processed', Icon: CheckCircle2, color: 'text-emerald-600' },
  rejected:  { label: 'Refund Rejected',  Icon: XCircle,      color: 'text-destructive' },
};

// ─── Refund Request Dialog ────────────────────────────────────────────────────

const RefundDialog = ({ order, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const retainedFee = Math.round((order.platform_fee_aud || 0) * 0.5 * 100) / 100;
  const refundAmount = Math.round(((order.total_aud || 0) - retainedFee) * 100) / 100;

  const handleSubmit = async () => {
    if (!reason) { toast.error('Please select a reason'); return; }
    setSaving(true);
    try {
      // Insert refund request
      const { error } = await supabase.from('refunds').insert({
        order_id:         order.id,
        buyer_id:         currentUser.id,
        seller_id:        order.seller_id,
        requested_by:     currentUser.id,
        reason:           reason + (notes ? ` — ${notes}` : ''),
        refund_type:      'full',
        item_price_aud:   order.item_price_aud || 0,
        commission_aud:   order.platform_fee_aud || 0,
        gst_aud:          order.gst_aud || 0,
        total_paid_aud:   order.total_aud || 0,
        retained_fee_aud: retainedFee,
        refund_amount_aud: refundAmount,
      });
      if (error) throw error;

      // Mark order refund_status
      await supabase.from('orders').update({
        refund_status:        'requested',
        refund_requested_at:  new Date().toISOString(),
      }).eq('id', order.id).eq('buyer_id', currentUser.id);

      // Notify seller
      if (order.seller_id) {
        await supabase.from('notifications').insert({
          user_id:    order.seller_id,
          type:       'refund_requested',
          title:      'Refund Request Received',
          body:       `A buyer has requested a refund on an order. Reason: ${REFUND_REASONS.find(r => r.value === reason)?.label || reason}.`,
        });
      }

      toast.success('Refund request submitted. We\'ll review it within 2 business days.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit refund request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold">Request a Refund</DialogTitle>
          <DialogDescription>Tell us what went wrong and we'll review your request within 2 business days.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Refund amount breakdown */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount you paid</span>
              <span className="font-bold">${(order.total_aud || 0).toFixed(2)} AUD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee retained (50%)</span>
              <span className="font-medium text-amber-700">−${retainedFee.toFixed(2)} AUD</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <span className="font-semibold text-foreground">You'll receive back</span>
              <span className="font-bold text-emerald-600">${refundAmount.toFixed(2)} AUD</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              CardPop retains 50% of the platform fee (${retainedFee.toFixed(2)}) to cover payment processing costs.
              Refunds take 5–10 business days to appear on your statement.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-sm">Reason for refund</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-xl bg-background border-border h-10">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-sm">Additional details <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Describe the issue in detail to help us resolve it faster..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="rounded-xl bg-background border-border resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-bold" disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!reason || saving} className="flex-1 rounded-xl font-bold">
            {saving ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Order Card ───────────────────────────────────────────────────────────────

const OrderCard = ({ order, onRefundRequest }) => {
  const statusCfg   = STATUS_CONFIG[order.status]        || STATUS_CONFIG.payment_confirmed;
  const refundCfg   = REFUND_STATUS_CONFIG[order.refund_status];
  const daysSince   = differenceInDays(new Date(), new Date(order.created_at));
  const canRefund   = !order.refund_status
    && !['refunded','cancelled','payment_failed'].includes(order.status)
    && ['payment_confirmed','shipped','completed'].includes(order.status)
    && daysSince <= REFUND_WINDOW_DAYS;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1">{order.order_number || order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-sm text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}</p>
        </div>
        <Badge variant="outline" className={`text-xs font-bold ${statusCfg.color}`}>
          {statusCfg.label}
        </Badge>
      </div>

      {/* Item name */}
      <p className="font-semibold text-foreground">
        {order.listing?.vault_item?.card_name || 'Trading Card Purchase'}
      </p>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-muted/30 rounded-xl p-3">
          <p className="text-muted-foreground mb-0.5">Item Price</p>
          <p className="font-bold text-foreground">${(order.item_price_aud || 0).toFixed(2)}</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-3">
          <p className="text-muted-foreground mb-0.5">Platform Fee</p>
          <p className="font-bold text-foreground">${(order.platform_fee_aud || 0).toFixed(2)}</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-3">
          <p className="text-muted-foreground mb-0.5">Total Paid</p>
          <p className="font-bold text-foreground">${(order.total_aud || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Seller */}
      {order.seller && (
        <p className="text-xs text-muted-foreground">
          Sold by{' '}
          <Link to={`/community/user/${order.seller_id}`} className="text-primary font-semibold hover:underline">
            {order.seller.display_name || order.seller.username}
          </Link>
        </p>
      )}

      {/* Refund status */}
      {refundCfg && (
        <div className={`flex items-center gap-2 text-xs font-semibold ${refundCfg.color}`}>
          <refundCfg.Icon className="w-4 h-4" />
          {refundCfg.label}
          {order.refund_status === 'processed' && (
            <span className="text-muted-foreground font-normal">— refund issued to your payment method</span>
          )}
        </div>
      )}

      {/* Refund eligibility note */}
      {!order.refund_status && canRefund && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />
          <span>
            50% of the platform fee (${Math.round((order.platform_fee_aud || 0) * 0.5 * 100) / 100} AUD) will be retained if a refund is approved.
            Refunds available for {REFUND_WINDOW_DAYS - daysSince} more day{REFUND_WINDOW_DAYS - daysSince !== 1 ? 's' : ''}.
          </span>
        </div>
      )}

      {/* Action */}
      {canRefund && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefundRequest(order)}
          className="w-full rounded-xl font-bold gap-2 text-xs h-9"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Request Refund
        </Button>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AccountOrders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refundTarget, setRefundTarget] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, seller:profiles!seller_id(id, display_name, username), listing:listings!listing_id(vault_item:vault_items!inner(card_name))')
      .eq('buyer_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders(data || []);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = statusFilter === 'all'
    ? orders
    : statusFilter === 'refund_requested'
      ? orders.filter(o => o.refund_status === 'requested')
      : orders.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <Helmet><title>My Orders | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Orders' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-1">My Orders</h1>
        <p className="text-muted-foreground">Your purchase history and refund requests.</p>
      </div>

      {/* Refund policy summary */}
      <div className="bg-blue-500/5 border border-blue-400/20 rounded-2xl p-4 flex gap-3 text-sm">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">CardPop Refund Policy</p>
          <p className="text-muted-foreground">
            Refunds can be requested within {REFUND_WINDOW_DAYS} days of purchase for items not received,
            not as described, or damaged. If approved, <strong>50% of the platform fee is non-refundable</strong> to
            cover payment processing costs — this is deducted from your refund automatically.
            All other amounts (item price + 50% of fee) are returned to your original payment method within 5–10 business days.
          </p>
          <Link to="/returns" className="text-primary font-semibold text-xs hover:underline">View full returns policy →</Link>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground font-medium">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] h-9 rounded-xl bg-background border-border text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="payment_confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="refund_requested">Refund Requested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-3xl">
          <ShoppingBag className="w-12 h-12 text-muted-foreground opacity-30 mb-4" />
          <p className="text-lg font-bold text-foreground mb-1">No orders found</p>
          <p className="text-muted-foreground text-sm">Your purchases will appear here once you've bought something.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onRefundRequest={setRefundTarget}
            />
          ))}
        </div>
      )}

      {refundTarget && (
        <RefundDialog
          order={refundTarget}
          onClose={() => setRefundTarget(null)}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  );
};

export default AccountOrders;
