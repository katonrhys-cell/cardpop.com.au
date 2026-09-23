import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Calculator, Download, RefreshCw, AlertTriangle, Receipt, Boxes, TrendingUp,
  Landmark, Calendar as CalendarIcon, Info,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatAud } from '@/utils/revenue.js';
import {
  periodOptions, filterByPeriod, summariseShopSales, summariseMarketplace, basSummary,
  inventoryValuation, toCsv, SALES_CSV_COLUMNS, INVENTORY_CSV_COLUMNS,
} from '@/utils/finance.js';

const pct = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);

const StatCard = ({ title, value, icon: Icon, description, loading, accent }) => (
  <Card className="shadow-sm border-border">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent>
      {loading ? <Skeleton className="h-8 w-24" /> : (
        <div className={`text-2xl font-extrabold tabular-nums tracking-tight ${accent || 'text-foreground'}`}>{value}</div>
      )}
      {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
    </CardContent>
  </Card>
);

const Row = ({ label, value, muted, strong, hint }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60 last:border-0">
    <div>
      <p className={`text-sm ${strong ? 'font-bold' : 'font-medium'} ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
    <span className={`tabular-nums text-sm ${strong ? 'font-extrabold' : 'font-semibold'} shrink-0`}>{value}</span>
  </div>
);

function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const FinanceTaxPage = () => {
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const options = useMemo(() => periodOptions(new Date()), []);
  const [periodKey, setPeriodKey] = useState(() => options.find((o) => o.value.endsWith('q1') || /q\d$/.test(o.value) && o.label.includes('current'))?.value || options[1]?.value || 'all');
  const period = useMemo(() => options.find((o) => o.value === periodKey) || options[0], [options, periodKey]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, refundsRes, productsRes, costsRes] = await Promise.all([
        supabase.from('orders').select('id, status, created_at, order_items, seller_id, shipping_aud, platform_fee_aud, processing_fee_aud, platform_gst_aud, seller_gst_aud, seller_proceeds_aud, gst_aud, gst_included_aud, total_aud').order('created_at', { ascending: false }),
        supabase.from('refunds').select('id, order_id, status, refund_amount_aud, processed_at'),
        supabase.from('shop_products').select('id, sku, title, status, price_aud, stock_quantity'),
        supabase.from('shop_product_costs').select('product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud'),
      ]);
      const loadError = [ordersRes.error, refundsRes.error, productsRes.error, costsRes.error].find(Boolean);
      if (loadError) throw loadError;
      setOrders(ordersRes.data || []);
      setRefunds(refundsRes.data || []);
      setProducts(productsRes.data || []);
      setCosts(new Map((costsRes.data || []).map((c) => [c.product_id, c])));
    } catch (err) {
      setError(err.message || 'Failed to load finance data.');
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rangedOrders = useMemo(() => filterByPeriod(orders, period), [orders, period]);
  const shop = useMemo(() => summariseShopSales(rangedOrders, costs, refunds), [rangedOrders, costs, refunds]);
  const marketplace = useMemo(() => summariseMarketplace(rangedOrders), [rangedOrders]);
  const bas = useMemo(() => basSummary(shop, marketplace), [shop, marketplace]);
  const inventory = useMemo(() => inventoryValuation(products.filter((p) => p.status !== 'archived'), costs), [products, costs]);

  const periodSlug = period.value;
  const exportSales = () => downloadCsv(`cardpop-shop-sales-${periodSlug}.csv`, toCsv(shop.lines, SALES_CSV_COLUMNS));
  const exportInventory = () => downloadCsv(`cardpop-inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`, toCsv(inventory.rows, INVENTORY_CSV_COLUMNS));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Finance &amp; Tax | Admin</title></Helmet>

      <AdminPageHeader
        icon={Calculator}
        title="Finance & Tax"
        subtitle="Profit on shop sales, GST by BAS period, stock on hand at cost, and exports for your accountant."
      >
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-[300px] h-10 rounded-xl border-white/20 bg-white/10 text-white">
            <CalendarIcon className="w-4 h-4 mr-2 text-white/60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchData} disabled={loading} className="h-10 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          These are management figures built from orders and wholesale costs, laid out with BAS labels so an accountant can map them.
          They are not a lodgement. GST credits below are estimated on the cost of goods <em>sold</em> in the period; the credit actually
          arises when stock is <em>purchased</em>, which this site does not record. Every seller&apos;s GST is withheld and remitted by CardPop
          with no registration test (see <code className="text-xs">docs/order-pricing.md</code>). Confirm the treatment with your accountant.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <AlertTriangle className="w-5 h-5" /> <span className="font-medium">{error}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Retry</Button>
        </div>
      )}

      {/* ── Headline ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Shop sales (ex GST)" value={formatAud(shop.salesEx)} icon={Receipt} loading={loading}
          description={`${shop.orderCount} order${shop.orderCount === 1 ? '' : 's'} · ${shop.unitsSold} unit${shop.unitsSold === 1 ? '' : 's'} · ${formatAud(shop.salesInc)} inc GST`} />
        <StatCard title="Cost of goods sold (ex GST)" value={formatAud(shop.cogsEx)} icon={Boxes} loading={loading}
          description={shop.linesMissingCost ? `${shop.linesMissingCost} line${shop.linesMissingCost === 1 ? '' : 's'} with no cost recorded` : 'From wholesale cost snapshots'} />
        <StatCard title="Gross profit (ex GST)" value={formatAud(shop.grossProfit)} icon={TrendingUp} loading={loading}
          accent={shop.grossProfit < 0 ? 'text-destructive' : 'text-emerald-600'} description={`Margin ${pct(shop.marginPct)} on shop goods`} />
        <StatCard title="Net GST on own supplies" value={formatAud(bas.netGstOwnSupplies)} icon={Landmark} loading={loading}
          description={`1A ${formatAud(bas.oneAGstOnSales)} − 1B est. ${formatAud(bas.oneBGstCreditsEstimate)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Shop P&L ───────────────────────────────────────────────── */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-base">Shop profit &amp; loss</CardTitle>
            <CardDescription>CardPop as the seller · {period.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <Row label="Sales inc GST" value={formatAud(shop.salesInc)} />
            <Row label="GST on sales" value={`− ${formatAud(shop.gstOnSales)}`} muted />
            <Row label="Sales ex GST" value={formatAud(shop.salesEx)} strong />
            <Row label="Shipping charged ex GST" value={formatAud(shop.shippingEx)} muted hint={`${formatAud(shop.shippingInc)} inc GST · GST ${formatAud(shop.shippingGst)}`} />
            <Row label="Cost of goods sold ex GST" value={`− ${formatAud(shop.cogsEx)}`} />
            <Row label="Gross profit on goods" value={formatAud(shop.grossProfit)} strong hint={`Margin ${pct(shop.marginPct)}`} />
            <Row label="Refunds settled" value={`− ${formatAud(shop.refunded)}`} muted hint="Against shop orders in this period" />
            {shop.linesUsingCurrentCost > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {shop.linesUsingCurrentCost} line{shop.linesUsingCurrentCost === 1 ? '' : 's'} predate cost snapshots and use today&apos;s wholesale cost.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Marketplace ────────────────────────────────────────────── */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-base">Marketplace fees</CardTitle>
            <CardDescription>CardPop as the platform · {marketplace.orderCount} listing order{marketplace.orderCount === 1 ? '' : 's'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Row label="Commission inc GST" value={formatAud(marketplace.commissionInc)} />
            <Row label="Processing fees inc GST" value={formatAud(marketplace.processingFeeInc)} />
            <Row label="GST inside CardPop's fees" value={`− ${formatAud(marketplace.platformGst)}`} muted />
            <Row label="Fee revenue ex GST" value={formatAud(marketplace.feesEx)} strong />
            <Row label="Seller GST withheld & remitted" value={formatAud(marketplace.sellerGstRemitted)} hint="Not CardPop's revenue — collected from seller payouts and passed to the ATO on their behalf" />
            <Row label="Paid out to sellers" value={formatAud(marketplace.sellerProceeds)} muted />
          </CardContent>
        </Card>

        {/* ── BAS ────────────────────────────────────────────────────── */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-base">BAS summary (estimate)</CardTitle>
            <CardDescription>{period.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <Row label="G1 · Total sales (inc GST)" value={formatAud(bas.g1TotalSalesInc)} hint="Shop goods + shipping + CardPop's own fees. Sellers' cards are their supplies, not CardPop's." />
            <Row label="1A · GST on sales" value={formatAud(bas.oneAGstOnSales)} />
            <Row label="1B · GST on purchases (estimate)" value={formatAud(bas.oneBGstCreditsEstimate)} hint="GST inside the wholesale cost of goods sold this period" />
            <Row label="Net GST on CardPop's own supplies" value={formatAud(bas.netGstOwnSupplies)} strong />
            <Row label="Plus seller GST remitted on their behalf" value={formatAud(bas.sellerGstRemittedOnBehalf)} muted />
            <Row label="Net GST payable incl. sellers" value={formatAud(bas.netGstPayableIncludingSellers)} strong />
          </CardContent>
        </Card>
      </div>

      {/* ── Inventory ────────────────────────────────────────────────── */}
      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Stock on hand</CardTitle>
            <CardDescription>
              {inventory.units} units · at cost {formatAud(inventory.costValueEx)} ex GST · at retail {formatAud(inventory.retailValueInc)} inc GST · potential gross profit {formatAud(inventory.potentialGrossProfit)}
              {inventory.missingCostWithStock > 0 && <> · <span className="text-amber-600 font-semibold">{inventory.missingCostWithStock} stocked product{inventory.missingCostWithStock === 1 ? '' : 's'} without a cost</span></>}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportInventory} disabled={loading || inventory.rows.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export stock CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost ex</TableHead>
                <TableHead className="text-right">Value at cost</TableHead>
                <TableHead className="text-right">Value at retail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>)}</TableRow>
              )) : inventory.rows.filter((r) => r.quantity > 0).slice(0, 25).map((r) => (
                <TableRow key={r.productId}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.unitCostEx == null ? <Badge variant="outline" className="text-amber-600 border-amber-500/30">no cost</Badge> : formatAud(r.unitCostEx)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.costValueEx == null ? '—' : formatAud(r.costValueEx)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatAud(r.retailValueInc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && inventory.rows.filter((r) => r.quantity > 0).length > 25 && (
            <p className="text-xs text-muted-foreground mt-3">Showing the 25 most valuable lines. The CSV export has every product.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Sales lines ──────────────────────────────────────────────── */}
      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Shop sales by line</CardTitle>
            <CardDescription>{shop.lineCount} line{shop.lineCount === 1 ? '' : 's'} in {period.label}. Each row is one product on one paid order.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/admin/revenue">Revenue breakdown</Link></Button>
            <Button variant="outline" size="sm" onClick={exportSales} disabled={loading || shop.lines.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Export sales CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Sale ex GST</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">COGS ex</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>)}</TableRow>
              )) : shop.lines.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No paid shop sales in this period.</TableCell></TableRow>
              ) : shop.lines.slice(0, 200).map((l, i) => (
                <TableRow key={`${l.orderId}-${l.productId}-${i}`}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{l.orderDate ? format(new Date(l.orderDate), 'd MMM yy') : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{l.orderRef}</TableCell>
                  <TableCell className="font-medium">{l.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAud(l.revenueEx)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatAud(l.gst)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.costSource === 'missing' ? <Badge variant="outline" className="text-amber-600 border-amber-500/30">no cost</Badge> : formatAud(l.cogsEx)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${l.grossProfit == null ? 'text-muted-foreground' : l.grossProfit < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    {l.grossProfit == null ? '—' : formatAud(l.grossProfit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pct(l.marginPct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceTaxPage;
