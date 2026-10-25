import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  DollarSign, Download, RefreshCw, Search, AlertCircle, ShoppingCart,
  TrendingUp, Receipt, RotateCcw, Landmark, ArrowUpDown, Calendar as CalendarIcon,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { format } from 'date-fns';
import OrderDetailDialog from '@/components/admin/OrderDetailDialog.jsx';
import {
  PAID_ORDER_STATUSES, RANGE_OPTIONS, CHANNEL_LABELS,
  summariseRevenue, bucketRevenue, revenueByChannel, revenueByStatus,
  filterOrdersByRange, rangeGranularity, orderGst, orderChannel, orderItemCount,
  formatAud, isPaidOrder,
} from '@/utils/revenue.js';

const STATUS_BADGE = {
  pending:           'bg-muted text-muted-foreground border-border',
  payment_confirmed: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400',
  shipped:           'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400',
  delivered:         'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400',
  completed:         'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400',
  refunded:          'bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-400',
  disputed:          'bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400',
  payment_failed:    'bg-destructive/10 text-destructive border-destructive/20',
  cancelled:         'bg-muted text-muted-foreground border-border',
};

const orderRef = (order) => (order?.id ? order.id.slice(0, 8).toUpperCase() : '—');

const buyerName = (order) =>
  order?.buyer?.display_name || order?.buyer?.username || order?.buyer_email || 'Guest';

const StatCard = ({ title, value, icon: Icon, description, loading, accent }) => (
  <Card className="shadow-sm border-border">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className={`text-2xl font-extrabold tabular-nums tracking-tight ${accent || 'text-foreground'}`}>{value}</div>
      )}
      {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
    </CardContent>
  </Card>
);

const RevenueBreakdownPage = () => {
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [range, setRange] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('paid');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [viewOrderId, setViewOrderId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, refundsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, buyer:profiles!buyer_id(id, display_name, username), seller:profiles!seller_id(id, display_name, username)')
          .order('created_at', { ascending: false }),
        supabase.from('refunds').select('id, order_id, status, refund_amount_aud, processed_at'),
      ]);

      // A partial failure here would quietly understate revenue (missing refunds
      // inflate net; missing orders deflate everything), so fail the whole page
      // rather than render a number that looks authoritative and isn't.
      const loadError = [ordersRes.error, refundsRes.error].find(Boolean);
      if (loadError) throw loadError;

      setOrders(ordersRes.data || []);
      setRefunds(refundsRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load revenue data.');
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Orders inside the selected date range — the basis for every figure below.
  const rangedOrders = useMemo(() => filterOrdersByRange(orders, range), [orders, range]);
  const summary = useMemo(() => summariseRevenue(rangedOrders, refunds), [rangedOrders, refunds]);
  const series = useMemo(
    () => bucketRevenue(rangedOrders, rangeGranularity(range)),
    [rangedOrders, range],
  );
  const channels = useMemo(() => revenueByChannel(rangedOrders), [rangedOrders]);
  const statuses = useMemo(() => revenueByStatus(rangedOrders), [rangedOrders]);

  // The table can show unpaid orders too, so an admin can see WHY an order
  // isn't in the total (abandoned checkout, failed card) instead of it simply
  // being absent with no explanation.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rangedOrders.filter((o) => {
      if (statusFilter === 'paid' && !isPaidOrder(o)) return false;
      if (statusFilter === 'unpaid' && isPaidOrder(o)) return false;
      if (statusFilter !== 'paid' && statusFilter !== 'unpaid' && statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!term) return true;
      return (
        orderRef(o).toLowerCase().includes(term) ||
        (o.id || '').toLowerCase().includes(term) ||
        buyerName(o).toLowerCase().includes(term) ||
        (Array.isArray(o.order_items) ? o.order_items : []).some((l) => (l?.title || '').toLowerCase().includes(term))
      );
    });

    const value = (o) => {
      switch (sort.key) {
        case 'total_aud': return Number(o.total_aud) || 0;
        case 'platform_fee_aud': return Number(o.platform_fee_aud) || 0;
        case 'gst': return orderGst(o);
        case 'buyer': return buyerName(o).toLowerCase();
        case 'status': return o.status || '';
        default: return new Date(o.created_at).getTime();
      }
    };

    return [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rangedOrders, search, statusFilter, sort]);

  const toggleSort = (key) =>
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'buyer' || key === 'status' ? 'asc' : 'desc' }));

  const SortHead = ({ label, sortKey, className = '' }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sort.key === sortKey ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </button>
    </TableHead>
  );

  const handleExport = () => {
    if (loading || error || !rows.length) return;

    const csvCell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const data = [
      ['Order Ref', 'Order ID', 'Sale Date', 'Sale Time', 'Buyer', 'Channel', 'Status',
       'Items', 'Item Subtotal (AUD)', 'Shipping (AUD)', 'Discount (AUD)',
       'Platform Fee (AUD)', 'GST (AUD)', 'Total (AUD)', 'Counts Toward Revenue'],
      ...rows.map((o) => [
        orderRef(o),
        o.id,
        format(new Date(o.created_at), 'yyyy-MM-dd'),
        format(new Date(o.created_at), 'HH:mm'),
        buyerName(o),
        CHANNEL_LABELS[orderChannel(o)] || orderChannel(o),
        o.status,
        orderItemCount(o),
        Number(o.item_price_aud) || 0,
        Number(o.shipping_aud) || 0,
        Number(o.discount_aud) || 0,
        Number(o.platform_fee_aud) || 0,
        orderGst(o).toFixed(2),
        Number(o.total_aud) || 0,
        isPaidOrder(o) ? 'yes' : 'no',
      ]),
    ];

    const csv = data.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cardpop-revenue-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} order${rows.length === 1 ? '' : 's'}`);
  };

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label || 'All time';

  return (
    <div className="space-y-6">
      <Helmet><title>Revenue Breakdown | Admin</title></Helmet>

      <AdminPageHeader
        icon={DollarSign}
        title="Revenue Breakdown"
        subtitle="Every sale that makes up total revenue — date, amount, fees and GST."
      >
        <Button asChild variant="outline" className="h-10 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Link to="/admin/finance">Finance &amp; Tax</Link>
        </Button>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[190px] h-10 rounded-xl border-white/20 bg-white/10 text-white">
            <CalendarIcon className="w-4 h-4 mr-2 text-white/60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={loading || !!error || !rows.length}
          className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={loading}
          className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Headline figures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Gross Revenue" value={formatAud(summary.gross)} icon={DollarSign}
          description={`${rangeLabel}, paid orders`} loading={loading}
        />
        <StatCard
          title="Refunds" value={`−${formatAud(summary.refunded)}`} icon={RotateCcw}
          description="Issued through Stripe" loading={loading}
          accent={summary.refunded > 0 ? 'text-destructive' : undefined}
        />
        <StatCard
          title="Net Revenue" value={formatAud(summary.net)} icon={TrendingUp}
          description="Gross less refunds" loading={loading}
        />
        <StatCard
          title="Platform Fees" value={formatAud(summary.platformFees)} icon={Landmark}
          description="Commission CardPop kept" loading={loading}
        />
        <StatCard
          title="GST Collected" value={formatAud(summary.gst)} icon={Receipt}
          description="Added plus price-inclusive" loading={loading}
        />
        <StatCard
          title="Paid Orders" value={summary.orderCount.toLocaleString()} icon={ShoppingCart}
          description={`Avg ${formatAud(summary.averageOrderValue)} per order`} loading={loading}
        />
      </div>

      {/* Revenue over time */}
      <Card className="border-border shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/10 pb-4">
          <CardTitle className="text-lg font-bold">Revenue Over Time</CardTitle>
          <CardDescription>
            Gross revenue per {rangeGranularity(range)} — {rangeLabel.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[280px] w-full">
            {loading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : series.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No paid orders in this period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    formatter={(value, _name, entry) => [
                      `${formatAud(value)} · ${entry?.payload?.orders} order${entry?.payload?.orders === 1 ? '' : 's'}`,
                      'Revenue',
                    ]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/10 pb-4">
            <CardTitle className="text-lg font-bold">By Sales Channel</CardTitle>
            <CardDescription>Where the money came from</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="font-semibold px-6">Channel</TableHead>
                  <TableHead className="font-semibold text-right">Orders</TableHead>
                  <TableHead className="font-semibold text-right px-6">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(2).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3} className="px-6"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : channels.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No paid orders yet.</TableCell></TableRow>
                ) : channels.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell className="font-medium px-6">{c.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold px-6">{formatAud(c.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/10 pb-4">
            <CardTitle className="text-lg font-bold">By Order Status</CardTitle>
            <CardDescription>How far through fulfilment the revenue sits</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="font-semibold px-6">Status</TableHead>
                  <TableHead className="font-semibold text-right">Orders</TableHead>
                  <TableHead className="font-semibold text-right px-6">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(2).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3} className="px-6"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : statuses.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No paid orders yet.</TableCell></TableRow>
                ) : statuses.map((s) => (
                  <TableRow key={s.status}>
                    <TableCell className="px-6">
                      <Badge variant="outline" className={`text-xs font-bold ${STATUS_BADGE[s.status] || 'bg-muted text-muted-foreground'}`}>
                        {s.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{s.orders}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold px-6">{formatAud(s.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Every sale */}
      <Card className="border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Sales Ledger</h3>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${rows.length} order${rows.length === 1 ? '' : 's'} · ${rangeLabel.toLowerCase()}`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search order, buyer or item…"
                className="pl-9 h-10 rounded-xl bg-background border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-xl bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Counts as revenue</SelectItem>
                <SelectItem value="unpaid">Not paid (excluded)</SelectItem>
                <SelectItem value="all">All orders</SelectItem>
                {PAID_ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <SortHead label="Sale Date" sortKey="created_at" className="px-6" />
                <TableHead className="font-semibold">Order</TableHead>
                <SortHead label="Buyer" sortKey="buyer" />
                <TableHead className="font-semibold">Channel</TableHead>
                <SortHead label="Status" sortKey="status" />
                <TableHead className="font-semibold text-right">Items</TableHead>
                <TableHead className="font-semibold text-right">Subtotal</TableHead>
                <TableHead className="font-semibold text-right">Shipping</TableHead>
                <SortHead label="Fee" sortKey="platform_fee_aud" className="text-right" />
                <SortHead label="GST" sortKey="gst" className="text-right" />
                <SortHead label="Amount" sortKey="total_aud" className="text-right px-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(11).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-40 text-center text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mb-3 mx-auto opacity-40" />
                    <p>No orders match these filters.</p>
                  </TableCell>
                </TableRow>
              ) : rows.map((o) => (
                <TableRow key={o.id} className={`group hover:bg-muted/40 transition-colors ${isPaidOrder(o) ? '' : 'opacity-60'}`}>
                  <TableCell className="px-6 whitespace-nowrap">
                    <span className="font-medium text-foreground">{format(new Date(o.created_at), 'dd MMM yyyy')}</span>
                    <span className="block text-xs text-muted-foreground">{format(new Date(o.created_at), 'h:mm a')}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setViewOrderId(o.id)}
                      className="text-primary hover:underline underline-offset-2"
                    >
                      {orderRef(o)}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium max-w-[160px] truncate" title={buyerName(o)}>{buyerName(o)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {CHANNEL_LABELS[orderChannel(o)] || orderChannel(o)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs font-bold whitespace-nowrap ${STATUS_BADGE[o.status] || 'bg-muted text-muted-foreground'}`}>
                      {(o.status || 'pending').replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{orderItemCount(o)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatAud(o.item_price_aud)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatAud(o.shipping_aud)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatAud(o.platform_fee_aud)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatAud(orderGst(o))}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold px-6 whitespace-nowrap">{formatAud(o.total_aud)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!loading && rows.length > 0 && (
          <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Rows shown at 60% opacity took no payment and are excluded from every total above.
            </p>
            <p className="font-bold text-foreground tabular-nums">
              Gross {formatAud(summary.gross)} · Net {formatAud(summary.net)}
            </p>
          </div>
        )}
      </Card>

      {viewOrderId && (
        <OrderDetailDialog orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
      )}
    </div>
  );
};

export default RevenueBreakdownPage;
