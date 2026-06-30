import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Download, RefreshCw, Pencil, Check, X, AlertCircle } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { toast } from 'sonner';
import { format, startOfMonth, subMonths } from 'date-fns';

// ─── Fee Config Table ─────────────────────────────────────────────────────────

const FeeRow = ({ row, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(String(row.fee_pct));
  const [active, setActive] = useState(row.is_active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('fee_config')
      .update({ fee_pct: parseFloat(pct), is_active: active })
      .eq('id', row.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Rate updated');
    setEditing(false);
    onSave();
  };

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 font-medium text-sm">{row.name}</td>
      <td className="py-3 px-4 text-sm text-muted-foreground capitalize">{row.seller_tier?.replace(/_/g, ' ') ?? '—'}</td>
      <td className="py-3 px-4">
        {editing ? (
          <Input
            type="number"
            value={pct}
            onChange={e => setPct(e.target.value)}
            className="w-20 h-8 rounded-lg text-sm"
            min="0" max="100" step="0.25"
          />
        ) : (
          <span className="text-sm font-bold">{row.fee_pct}%</span>
        )}
      </td>
      <td className="py-3 px-4">
        {editing ? (
          <Switch checked={active} onCheckedChange={setActive} />
        ) : (
          <Badge variant={row.is_active ? 'default' : 'secondary'} className="text-xs">
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        {editing ? (
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={save} disabled={saving} className="h-7 px-3 rounded-lg text-xs font-bold">
              <Check className="w-3 h-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setPct(String(row.fee_pct)); setActive(row.is_active); }} className="h-7 px-3 rounded-lg text-xs">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-3 rounded-lg text-xs">
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
        )}
      </td>
    </tr>
  );
};

// ─── Platform Settings Toggle ─────────────────────────────────────────────────

const SettingToggle = ({ label, description, settingKey, value, onChange }) => (
  <div className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0">
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <Switch
      checked={!!value}
      onCheckedChange={v => onChange(settingKey, v)}
      className="shrink-0 mt-0.5"
    />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const CommissionSettingsPage = () => {
  const [feeConfigs, setFeeConfigs] = useState([]);
  const [settings, setSettings] = useState({});
  const [loadingFees, setLoadingFees] = useState(true);
  const [savingSettings, setSavingSettings] = useState({});

  // Revenue stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsPeriod, setStatsPeriod] = useState('30');

  // Transaction history
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [txPage, setTxPage] = useState(0);
  const TX_PAGE_SIZE = 20;

  const fetchFeeConfigs = useCallback(async () => {
    setLoadingFees(true);
    const { data } = await supabase.from('fee_config').select('*').order('fee_pct', { ascending: false });
    setFeeConfigs(data || []);
    setLoadingFees(false);
  }, []);

  const fetchSettings = useCallback(async () => {
    const keys = [
      'commissions_enabled', 'gst_enabled', 'gst_rate_pct', 'gst_on_commission_only',
      'commission_on_offers', 'commission_on_auctions', 'commission_on_trades', 'commission_on_featured',
    ];
    const { data } = await supabase.from('platform_settings').select('key, value').in('key', keys);
    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });
    setSettings(map);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const days = parseInt(statsPeriod);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('orders')
      .select('total_aud, platform_fee_aud, commission_pct, gst_aud, seller_proceeds_aud, created_at, status, transaction_type')
      .gte('created_at', since)
      .in('status', ['payment_confirmed', 'shipped', 'completed']);

    if (data) {
      const totalGross    = data.reduce((s, r) => s + (r.total_aud || 0), 0);
      const totalFees     = data.reduce((s, r) => s + (r.platform_fee_aud || 0), 0);
      const totalGst      = data.reduce((s, r) => s + (r.gst_aud || 0), 0);
      const totalProceeds = data.reduce((s, r) => s + (r.seller_proceeds_aud || 0), 0);
      setStats({ totalGross, totalFees, totalGst, totalProceeds, orderCount: data.length });
    }
    setLoadingStats(false);
  }, [statsPeriod]);

  const fetchTransactions = useCallback(async () => {
    setLoadingTx(true);
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, total_aud, item_price_aud, platform_fee_aud, commission_pct, gst_aud, seller_proceeds_aud, transaction_type, status, buyer:profiles!buyer_id(username), seller:profiles!seller_id(username)')
      .order('created_at', { ascending: false })
      .range(txPage * TX_PAGE_SIZE, (txPage + 1) * TX_PAGE_SIZE - 1);
    setTransactions(data || []);
    setLoadingTx(false);
  }, [txPage]);

  useEffect(() => { fetchFeeConfigs(); fetchSettings(); }, [fetchFeeConfigs, fetchSettings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleSettingToggle = async (key, newValue) => {
    setSavingSettings(s => ({ ...s, [key]: true }));
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: newValue })
      .eq('key', key);
    setSavingSettings(s => ({ ...s, [key]: false }));
    if (error) { toast.error(`Failed to update ${key}`); return; }
    setSettings(s => ({ ...s, [key]: newValue }));
    toast.success('Setting saved');
  };

  const exportCsv = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, total_aud, item_price_aud, platform_fee_aud, commission_pct, gst_aud, seller_proceeds_aud, transaction_type, status')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!data?.length) { toast.info('No data to export'); return; }

    const headers = ['ID', 'Date', 'Total AUD', 'Item Price', 'Platform Fee', 'Commission %', 'GST', 'Seller Proceeds', 'Type', 'Status'];
    const rows = data.map(r => [
      r.id,
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
      r.total_aud,
      r.item_price_aud,
      r.platform_fee_aud,
      r.commission_pct,
      r.gst_aud,
      r.seller_proceeds_aud,
      r.transaction_type,
      r.status,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cardpop-revenue-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ label, value, sub, icon: Icon, color = 'text-primary' }) => (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      {loadingStats ? (
        <Skeleton className="h-8 w-28 rounded-md" />
      ) : (
        <>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <Helmet><title>Commission Settings | CardPop Admin</title></Helmet>

      <AdminPageHeader
        icon={DollarSign}
        title="Commission & Revenue"
        subtitle="Manage platform fees, GST settings, and view revenue reports."
      >
        <Button onClick={exportCsv} variant="outline" className="rounded-xl font-bold gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </AdminPageHeader>

      {/* ── Revenue Stats ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Revenue Summary</h2>
          <div className="flex items-center gap-3">
            <Select value={statsPeriod} onValueChange={setStatsPeriod}>
              <SelectTrigger className="w-[150px] h-9 rounded-xl bg-background border-border text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={fetchStats} className="rounded-full h-9 w-9 bg-muted/50">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Gross Sales"      value={`$${(stats?.totalGross    ?? 0).toFixed(2)}`} sub={`${stats?.orderCount ?? 0} orders`} icon={DollarSign} />
          <StatCard label="Platform Revenue" value={`$${(stats?.totalFees     ?? 0).toFixed(2)}`} sub="Fees collected"                      icon={TrendingUp}  color="text-emerald-500" />
          <StatCard label="GST Collected"    value={`$${(stats?.totalGst      ?? 0).toFixed(2)}`} sub="10% of commission"                   icon={DollarSign}  color="text-amber-500" />
          <StatCard label="Seller Proceeds"  value={`$${(stats?.totalProceeds ?? 0).toFixed(2)}`} sub="After fees"                          icon={DollarSign}  color="text-blue-500" />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ── Fee Config Table ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Commission Rates by Seller Tier</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loadingFees ? (
              <div className="p-6 space-y-3">{[0,1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-9 w-full rounded-md" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Tier</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Rate</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {feeConfigs.map(row => (
                    <FeeRow key={row.id} row={row} onSave={fetchFeeConfigs} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Platform Settings ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Platform Settings</h2>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
            <SettingToggle
              label="Commissions Enabled"
              description="Master switch — disabling this waives all fees globally."
              settingKey="commissions_enabled"
              value={settings['commissions_enabled']}
              onChange={handleSettingToggle}
            />
            <SettingToggle
              label="GST Enabled"
              description="Collect 10% GST on top of commission fees."
              settingKey="gst_enabled"
              value={settings['gst_enabled']}
              onChange={handleSettingToggle}
            />
            <SettingToggle
              label="GST on Commission Only"
              description="When off, GST applies to the full transaction value."
              settingKey="gst_on_commission_only"
              value={settings['gst_on_commission_only']}
              onChange={handleSettingToggle}
            />
            <SettingToggle
              label="Commission on Buy Now / Fixed"
              description="Charge commission on fixed-price listings."
              settingKey="commission_on_offers"
              value={settings['commission_on_offers']}
              onChange={handleSettingToggle}
            />
            <SettingToggle
              label="Commission on Auctions"
              description="Charge commission on auction sales."
              settingKey="commission_on_auctions"
              value={settings['commission_on_auctions']}
              onChange={handleSettingToggle}
            />
            <SettingToggle
              label="Commission on Offers"
              description="Charge commission on accepted offer purchases."
              settingKey="commission_on_offers"
              value={settings['commission_on_offers']}
              onChange={handleSettingToggle}
            />
            <SettingToggle
              label="Commission on Trades"
              description="Charge commission on trade transactions."
              settingKey="commission_on_trades"
              value={settings['commission_on_trades']}
              onChange={handleSettingToggle}
            />
          </div>
        </section>
      </div>

      {/* ── Transaction History ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Transaction Revenue History</h2>
          <Button variant="ghost" size="sm" onClick={fetchTransactions} className="rounded-xl gap-2 text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Date', 'Buyer', 'Seller', 'Type', 'Item Price', 'Fee', 'GST', 'Total', 'Status'].map(h => (
                    <th key={h} className="py-3 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTx ? (
                  Array(8).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={9} className="py-2 px-4"><Skeleton className="h-5 w-full rounded" /></td></tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">No transactions found</td></tr>
                ) : transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(tx.created_at), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">{tx.buyer?.username || '—'}</td>
                    <td className="py-3 px-4 text-xs font-medium">{tx.seller?.username || '—'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs capitalize">{tx.transaction_type || 'fixed'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">${(tx.item_price_aud || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-xs font-mono text-emerald-600">${(tx.platform_fee_aud || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-xs font-mono text-amber-600">${(tx.gst_aud || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-xs font-mono font-bold">${(tx.total_aud || 0).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {tx.status?.replace(/_/g, ' ') || '—'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {txPage + 1}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0} className="h-8 px-3 rounded-lg text-xs font-bold">Previous</Button>
              <Button size="sm" variant="outline" onClick={() => setTxPage(p => p + 1)} disabled={transactions.length < TX_PAGE_SIZE} className="h-8 px-3 rounded-lg text-xs font-bold">Next</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommissionSettingsPage;
