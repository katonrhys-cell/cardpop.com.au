import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Package, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format } from 'date-fns';

const STATUS_BADGE = {
  pending:           'bg-muted text-muted-foreground border-border',
  payment_confirmed: 'bg-blue-500/10 text-blue-700 border-blue-200',
  shipped:           'bg-amber-500/10 text-amber-700 border-amber-200',
  completed:         'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  refunded:          'bg-violet-500/10 text-violet-700 border-violet-200',
  payment_failed:    'bg-destructive/10 text-destructive border-destructive/20',
  cancelled:         'bg-muted text-muted-foreground border-border',
};

const fmt = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val || 0);

// Shared admin order-detail viewer. Fetches the full order row (with buyer/
// seller joins) by id so any list that only holds an order id — the Recent
// Orders widget, the Order Management table — can link straight into it
// instead of duplicating this fetch/layout per caller.
const OrderDetailDialog = ({ orderId, onClose }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*, buyer:profiles!buyer_id(id, display_name, username, email), seller:profiles!seller_id(id, display_name, username)')
        .eq('id', orderId)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
      } else if (!data) {
        setError('Order not found.');
      } else {
        setOrder(data);
      }
      setLoading(false);
    };
    fetchOrder();
    return () => { cancelled = true; };
  }, [orderId]);

  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  const hasShipping = order && (order.shipping_address || order.shipping_suburb);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold font-mono">
            {order?.order_number || (orderId ? orderId.slice(0, 8).toUpperCase() : 'Order')}
          </DialogTitle>
          <DialogDescription>Order details</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : (
          <div className="space-y-5 py-2 text-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="outline" className={`text-xs font-bold ${STATUS_BADGE[order.status] || 'bg-muted text-muted-foreground'}`}>
                {(order.status || 'pending').replace(/_/g, ' ')}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-muted-foreground text-xs mb-0.5">Buyer</p>
                <p className="font-semibold text-foreground truncate">
                  {order.buyer?.display_name || order.buyer?.username || order.buyer_email || 'Unknown User'}
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-muted-foreground text-xs mb-0.5">Seller</p>
                <p className="font-semibold text-foreground truncate">
                  {order.seller?.display_name || order.seller?.username || 'CardPop Shop'}
                </p>
              </div>
            </div>

            {/* Items */}
            {items.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Items
                </p>
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{item.title || 'Item'}</p>
                        <p className="text-xs text-muted-foreground">Qty {item.quantity || 1}</p>
                      </div>
                      <p className="font-medium tabular-nums shrink-0">{fmt(item.line_total_aud)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financials */}
            <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item price</span>
                <span className="font-medium">{fmt(order.item_price_aud)}</span>
              </div>
              {!!order.shipping_aud && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">{fmt(order.shipping_aud)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee</span>
                <span className="font-medium">{fmt(order.platform_fee_aud)}</span>
              </div>
              {!!order.discount_aud && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-emerald-600">−{fmt(order.discount_aud)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold">{fmt(order.total_aud)}</span>
              </div>
            </div>

            {/* Shipping address */}
            {hasShipping && (
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Shipping Address
                </p>
                <div className="bg-muted/30 rounded-xl p-3 text-muted-foreground">
                  {order.shipping_name && <p className="text-foreground font-medium">{order.shipping_name}</p>}
                  {order.shipping_address && <p>{order.shipping_address}</p>}
                  <p>
                    {[order.shipping_suburb, order.shipping_state, order.shipping_postcode].filter(Boolean).join(' ')}
                  </p>
                </div>
              </div>
            )}

            {order.refund_status && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Refund status:</span>
                <Badge variant="outline" className="font-bold">{order.refund_status.replace(/_/g, ' ')}</Badge>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailDialog;
