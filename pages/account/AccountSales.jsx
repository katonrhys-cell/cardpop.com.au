import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Package, Truck, MapPin, CheckCircle2, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CARRIERS, CARRIER_IDS, DEFAULT_CARRIER, carrierLabel, trackingUrl, isValidTrackingNumber } from '@/utils/shipmentTracking.js';
import { MARKETPLACE_PROTECTION } from '@/utils/buyerProtectionPolicy.js';

// Account → Sales: everything a seller must do after a card sells — see where
// to post it, and mark it shipped with tracking. Until this page existed a
// seller had no way to see the buyer's address (the orders row is deliberately
// unreadable to per-line sellers) and only an admin could mark an order
// shipped, so marketplace buyers never got a tracking email. Data comes from
// the seller_sales() / seller_sale_shipping() functions, which return only the
// caller's own sales — see docs/order-delivery.md.

const STATUS = {
  payment_confirmed: { label: 'To ship', cls: 'bg-amber-500/10 text-amber-700 border-amber-200', Icon: Clock },
  shipped:           { label: 'Shipped', cls: 'bg-blue-500/10 text-blue-700 border-blue-200', Icon: Truck },
  completed:         { label: 'Delivered', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  refunded:          { label: 'Refunded', cls: 'bg-violet-500/10 text-violet-700 border-violet-200', Icon: Package },
  cancelled:         { label: 'Cancelled', cls: 'bg-muted text-muted-foreground border-border', Icon: Package },
  pending:           { label: 'Awaiting payment', cls: 'bg-muted text-muted-foreground border-border', Icon: Clock },
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const daysSince = (v) => (v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : 0);

// Group the per-line rows seller_sales() returns into one card per order.
function groupSales(rows) {
  const byOrder = new Map();
  for (const r of rows) {
    const g = byOrder.get(r.order_id) || { ...r, lines: [] };
    g.lines.push(r);
    byOrder.set(r.order_id, g);
  }
  return [...byOrder.values()];
}

const ShipDialog = ({ sale, onClose, onShipped }) => {
  const [carrier, setCarrier] = useState(sale.tracking_carrier || DEFAULT_CARRIER);
  const [tracking, setTracking] = useState(sale.tracking_number || '');
  const [saving, setSaving] = useState(false);
  const valid = isValidTrackingNumber(tracking);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) { toast.error('Enter the tracking number from your postage receipt.'); return; }
    setSaving(true);
    try {
      const res = await apiServerClient.fetch(`/orders/${sale.order_id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, tracking_number: tracking, notify: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not mark the order shipped');
      toast.success(body.emailed ? 'Marked as shipped — the buyer has been emailed their tracking link.' : 'Marked as shipped.');
      onShipped();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as shipped</DialogTitle>
          <DialogDescription>
            Post with a tracked service — a tracked parcel is what protects you against a false “not received” claim. The buyer is emailed the tracking link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ship-carrier">Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger id="ship-carrier"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARRIER_IDS.map((id) => <SelectItem key={id} value={id}>{CARRIERS[id].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ship-tracking">Tracking number</Label>
            <Input id="ship-tracking" value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase())} placeholder="e.g. 33ABC1234567" autoComplete="off" className="font-mono" />
            <p className="text-xs text-muted-foreground">Letters, digits and dashes, 4–40 characters.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !valid} className="font-bold">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />} Mark as shipped
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddressBlock = ({ orderId }) => {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('seller_sale_shipping', { p_order_id: orderId }).then(({ data, error }) => {
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      setState({ loading: false, data: row || null, error: error?.message || (row ? null : 'No address on this order') });
    });
    return () => { cancelled = true; };
  }, [orderId]);
  if (state.loading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!state.data) return <p className="text-xs text-destructive">{state.error}</p>;
  const a = state.data;
  return (
    <address className="not-italic rounded-xl bg-muted/40 p-3 text-sm leading-relaxed" data-testid="delivery-address">
      <span className="block font-semibold text-foreground">{a.shipping_name || a.buyer_name}</span>
      <span className="block">{a.shipping_address}</span>
      <span className="block">{[a.shipping_suburb, a.shipping_state, a.shipping_postcode].filter(Boolean).join(' ')}</span>
    </address>
  );
};

const SaleCard = ({ sale, onShip, onChanged }) => {
  const [showAddress, setShowAddress] = useState(false);
  const cfg = STATUS[sale.order_status] || STATUS.pending;
  const toShip = sale.order_status === 'payment_confirmed';
  const shipped = sale.order_status === 'shipped';
  const late = toShip && daysSince(sale.sold_at) >= MARKETPLACE_PROTECTION.notShippedClaimAfterDays;
  const titles = sale.lines.map((l) => l.item_title).filter(Boolean);
  const proceeds = sale.lines.reduce((t, l) => t + Number(l.proceeds_aud || 0), 0);
  const url = sale.tracking_number ? trackingUrl(sale.tracking_carrier, sale.tracking_number) : null;

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{sale.order_id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-muted-foreground">Sold {fmtDate(sale.sold_at)}{sale.buyer_name ? ` to ${sale.buyer_name}` : ''}</p>
          </div>
          <Badge variant="outline" className={`text-xs font-bold ${cfg.cls}`}><cfg.Icon className="mr-1 h-3.5 w-3.5" />{cfg.label}</Badge>
        </div>

        <p className="font-semibold text-foreground">{titles.length ? titles.join(', ') : 'Marketplace sale'}</p>
        <p className="text-sm text-muted-foreground">Your proceeds: <span className="font-bold text-emerald-600">${proceeds.toFixed(2)}</span></p>

        {toShip && (
          <div className={`rounded-xl border p-3 text-xs ${late ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-amber-200 bg-amber-500/5 text-amber-800'}`}>
            {late
              ? `Posted yet? It's been ${daysSince(sale.sold_at)} days — the buyer can now report this as not received.`
              : `Please post within ${MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days of the sale (${MARKETPLACE_PROTECTION.notShippedClaimAfterDays - daysSince(sale.sold_at)} left) using a tracked service.`}
          </div>
        )}

        {(toShip || shipped) && (
          <div className="space-y-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-semibold" onClick={() => setShowAddress((v) => !v)}>
              <MapPin className="h-3.5 w-3.5" /> {showAddress ? 'Hide delivery address' : 'Show delivery address'}
            </Button>
            {showAddress && <AddressBlock orderId={sale.order_id} />}
          </div>
        )}

        {sale.tracking_number && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-3 text-xs">
            <Truck className="h-4 w-4 shrink-0 text-primary/70" />
            <span className="text-muted-foreground">{carrierLabel(sale.tracking_carrier)}:</span>
            {url
              ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-primary hover:underline">{sale.tracking_number} <ExternalLink className="inline h-3 w-3" /></a>
              : <span className="font-mono font-semibold">{sale.tracking_number}</span>}
            {sale.shipped_at && <span className="ml-auto text-muted-foreground">posted {fmtDate(sale.shipped_at)}</span>}
          </div>
        )}
        {sale.delivered_at && (
          <p className="text-xs text-emerald-700">Delivered {fmtDate(sale.delivered_at)}.</p>
        )}

        {toShip && (
          <Button className="w-full rounded-xl font-bold" onClick={() => onShip(sale)}>
            <Truck className="mr-2 h-4 w-4" /> Mark as shipped
          </Button>
        )}
        {shipped && !sale.delivered_at && (
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold" onClick={() => onShip(sale)}>
            Update tracking
          </Button>
        )}
        {onChanged && null}
      </CardContent>
    </Card>
  );
};

const AccountSales = () => {
  const { currentUser } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shipTarget, setShipTarget] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('seller_sales', { p_limit: 100 });
    if (error) toast.error('Could not load your sales.');
    setSales(groupSales(data || []));
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  const visible = sales.filter((s) => filter === 'all' || (filter === 'to_ship' ? s.order_status === 'payment_confirmed' : s.order_status === filter));
  const toShipCount = sales.filter((s) => s.order_status === 'payment_confirmed').length;

  return (
    <AccountPageShell
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Sales' }]}
      title="My Sales"
      description="Post what you've sold, mark it shipped with tracking, and see when it arrived."
      actions={<Button asChild variant="outline" className="rounded-xl font-bold"><Link to="/account/wallet">Payouts</Link></Button>}
    >
      <Helmet><title>My Sales | CardPop</title></Helmet>

      {toShipCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-500/5 p-4 text-sm">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>
            <span className="font-semibold text-foreground">{toShipCount} sale{toShipCount !== 1 ? 's' : ''} to post.</span>{' '}
            Buyers can report an order as not received after {MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days without tracking — mark each parcel shipped as soon as it's posted.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm font-medium text-muted-foreground">{visible.length} sale{visible.length !== 1 ? 's' : ''}</p>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-[180px] rounded-xl bg-background text-sm font-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sales</SelectItem>
            <SelectItem value="to_ship">To ship</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="completed">Delivered</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card py-20 text-center">
          <Package className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
          <p className="mb-1 text-lg font-bold text-foreground">No sales here yet</p>
          <p className="text-sm text-muted-foreground">When a card sells, it shows up here with the buyer's address and a Mark as shipped button.</p>
          <Button asChild className="mt-6 rounded-xl font-bold"><Link to="/vault/add">List a card</Link></Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((sale) => <SaleCard key={sale.order_id} sale={sale} onShip={setShipTarget} />)}
        </div>
      )}

      {shipTarget && <ShipDialog sale={shipTarget} onClose={() => setShipTarget(null)} onShipped={load} />}
    </AccountPageShell>
  );
};

export default AccountSales;
