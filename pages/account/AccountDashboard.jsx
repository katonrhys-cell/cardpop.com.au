
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Package, List, ArrowRightLeft, DollarSign, ArrowRight, AlertCircle, RefreshCw, PackageOpen, Award } from 'lucide-react';
import SellerTierBadge from '@/components/SellerTierBadge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import AccountPlanBanner from '@/components/AccountPlanBanner.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const AccountDashboard = () => {
  const { currentUser } = useAuth();

  const [stats, setStats] = useState({
    salesCount: 0, revenue: 0, listingsCount: 0, vaultItemsCount: 0, pendingTrades: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [sellerTier, setSellerTier] = useState(null);

  const [vaultItems, setVaultItems]           = useState([]);
  const [vaultLoading, setVaultLoading]       = useState(false);
  const [vaultError, setVaultError]           = useState(null);
  const [vaultPage, setVaultPage]             = useState(1);
  const [vaultTotalPages, setVaultTotalPages] = useState(1);

  // Stable refs so realtime callbacks always call the latest fetch without
  // being in the realtime effect's dep array (which would recreate the channel).
  const fetchStatsRef  = useRef(null);
  const fetchVaultRef  = useRef(null);
  const vaultPageRef   = useRef(1);
  vaultPageRef.current = vaultPage;

  // ── Stats fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) { setStatsLoading(false); return; }

    let cancelled = false;

    const run = async () => {
      setStatsLoading(true);
      setStatsError(null);

      // Fetch seller tier independently — a missing profile row must not block stats
      supabase.from('profiles').select('seller_tier').eq('id', currentUser.id).maybeSingle()
        .then(({ data }) => { if (!cancelled && data) setSellerTier(data.seller_tier); })

      try {
        const [salesRes, revenueRes, listingsRes, vaultRes, tradesRes] = await Promise.all([
          // "Completed Sales" / "Total Revenue" are seller-side stats, so scope
          // to seller_id (not buyer OR seller — a user's own purchases aren't
          // their revenue) and use the real terminal order status 'completed'
          // ('delivered' is never written anywhere, so this was always 0).
          supabase.from('orders').select('id', { count: 'exact', head: true })
            .eq('seller_id', currentUser.id)
            .eq('status', 'completed'),
          supabase.from('orders').select('total_aud')
            .eq('seller_id', currentUser.id)
            .eq('status', 'completed'),
          supabase.from('listings').select('id', { count: 'exact', head: true })
            .eq('seller_id', currentUser.id).eq('status', 'active').neq('listing_type', 'vault'),
          supabase.from('vault_items').select('id', { count: 'exact', head: true })
            .eq('owner_id', currentUser.id),
          supabase.from('trades').select('id', { count: 'exact', head: true })
            .or(`initiator_id.eq.${currentUser.id},responder_id.eq.${currentUser.id}`)
            .eq('status', 'proposed'),
        ]);

        if (cancelled) return;

        // Log individual errors without crashing the whole dashboard. Supabase
        // resolves (never rejects) a failed query, so a per-query error here
        // previously went unchecked — count/data falls back to 0/[] below,
        // silently rendering a real failure as "0 sales" / "$0 revenue"
        // instead of surfacing it.
        const namedResults = { sales: salesRes, revenue: revenueRes, listings: listingsRes, vault: vaultRes, trades: tradesRes };
        const failed = Object.entries(namedResults).filter(([, r]) => r.error);
        if (failed.length > 0) {
          failed.forEach(([name, r]) => console.error(`Failed to load ${name} stats:`, r.error));
          setStatsError('Some statistics failed to load — the numbers below may be incomplete. Try refreshing.');
        }

        const revenue = (revenueRes.data || []).reduce((s, t) => s + (t.total_aud || 0), 0);
        setStats({
          salesCount:      salesRes.count    || 0,
          revenue,
          listingsCount:   listingsRes.count  || 0,
          vaultItemsCount: vaultRes.count    || 0,
          pendingTrades:   tradesRes.count   || 0,
        });
      } catch (err) {
        if (!cancelled) setStatsError('Failed to load live statistics. Please try refreshing.');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    fetchStatsRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // ── Vault items fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) { setVaultLoading(false); return; }

    let cancelled = false;
    const uid = currentUser.id;

    const run = async (page = vaultPage) => {
      setVaultLoading(true);
      setVaultError(null);
      try {
        const from = (page - 1) * 10;
        const { data: items, count, error: vaultFetchError } = await supabase
          .from('vault_items').select('*', { count: 'exact' })
          .eq('owner_id', uid)
          .order('created_at', { ascending: false })
          .range(from, from + 9);
        if (vaultFetchError) throw vaultFetchError;
        if (cancelled) return;
        setVaultItems(items ?? []);
        setVaultPage(page);
        setVaultTotalPages(Math.ceil((count ?? 0) / 10));
      } catch (err) {
        if (!cancelled) setVaultError(err.message || 'Failed to load vault items.');
      } finally {
        if (!cancelled) setVaultLoading(false);
      }
    };

    fetchVaultRef.current = (page) => run(page ?? vaultPageRef.current);
    run(vaultPage);
    return () => { cancelled = true; };
  }, [currentUser?.id, vaultPage]);

  // ── Realtime subscription (stable — never torn down while user is logged in)
  // Every listener is filtered to this user's rows — unfiltered, any user's
  // write anywhere would refetch every logged-in dashboard. Tables where the
  // user can sit on either side (orders, trades) get one listener per column,
  // since postgres_changes filters can't express OR.
  useEffect(() => {
    if (!currentUser?.id) return;
    const uid = currentUser.id;
    const channel = supabase.channel(`dashboard-rt-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${uid}` },
        () => fetchStatsRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${uid}` },
        () => fetchStatsRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings', filter: `seller_id=eq.${uid}` },
        () => fetchStatsRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_items', filter: `owner_id=eq.${uid}` },
        () => { fetchStatsRef.current?.(); fetchVaultRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `initiator_id=eq.${uid}` },
        () => fetchStatsRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `responder_id=eq.${uid}` },
        () => fetchStatsRef.current?.())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const handleRefresh = () => {
    fetchStatsRef.current?.();
    fetchVaultRef.current?.();
    toast.success('Dashboard data refreshed successfully');
  };

  const formattedRevenue = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(stats.revenue);

  return (
    <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-8 animate-in fade-in duration-300">
      <Helmet>
        <title>Account Dashboard | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Dashboard' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2 tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-lg font-medium">Welcome back! Here's your live account overview.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={statsLoading || vaultLoading}
          className="rounded-xl shadow-sm self-start sm:self-auto h-10 px-4 font-bold transition-transform active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${(statsLoading || vaultLoading) ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {statsError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold tracking-wide">Data Synchronization Error</p>
            <p className="text-sm opacity-90">{statsError}</p>
          </div>
        </div>
      )}

      {/* Plan status + next-step nudges (Hobby vs Pro) */}
      <AccountPlanBanner />

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                {formattedRevenue}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Sales</CardTitle>
            <ArrowRightLeft className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{stats.salesCount}</div>
            )}
            <Link to="/transactions" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">
              View transactions &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Listings</CardTitle>
            <List className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{stats.listingsCount}</div>
            )}
            <Link to="/account/listings" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">
              Manage listings &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vault Items</CardTitle>
            <Package className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{stats.vaultItemsCount}</div>
            )}
            <Link to="/my-vault" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">
              Open vault &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Trades</CardTitle>
            <ArrowRightLeft className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{stats.pendingTrades}</div>
            )}
            <Link to="/trade-requests" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">
              Review requests &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Seller Tier</CardTitle>
            <Award className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {statsLoading ? <Skeleton className="h-7 w-28" /> : (
              sellerTier && sellerTier !== 'none'
                ? <SellerTierBadge tier={sellerTier} size="sm" />
                : <span className="text-sm font-bold text-muted-foreground">New Seller</span>
            )}
            <Link to="/account/seller-tier" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">
              View progress &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vault Items Table */}
        <Card className="shadow-sm border-border bg-card rounded-[1.5rem] lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="font-serif">Recent Vault Items</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage your synced collection</p>
            </div>
            {vaultError && (
              <Button variant="outline" size="sm" onClick={() => fetchVaultRef.current?.(vaultPage)} disabled={vaultLoading}>
                Retry
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {vaultLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-1/4" />
                    <Skeleton className="h-10 w-1/4" />
                    <Skeleton className="h-10 w-1/4" />
                    <Skeleton className="h-10 w-1/4" />
                  </div>
                ))}
              </div>
            ) : vaultError ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertCircle className="w-10 h-10 text-destructive mb-3 opacity-80" />
                <p className="text-muted-foreground">{vaultError}</p>
              </div>
            ) : vaultItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <PackageOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-foreground">Your vault is empty</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">You haven't added any cards to your vault yet. Start building your collection.</p>
                <Button asChild>
                  <Link to="/vault/add">Add First Item</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Card Name</TableHead>
                      <TableHead>Set</TableHead>
                      <TableHead>Condition / Grade</TableHead>
                      <TableHead className="text-right">Est. Value (AUD)</TableHead>
                      <TableHead className="text-right min-w-fit">Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vaultItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.card_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.set_name || '—'}</TableCell>
                        <TableCell>
                          {item.grading_company && item.grade ? (
                            <Badge variant="outline" className="whitespace-nowrap uppercase">
                              {`${item.grading_company} ${item.grade}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="whitespace-nowrap capitalize">
                              {item.condition?.replace(/_/g, ' ') || 'Unknown'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.estimated_value_aud != null ? `$${Number(item.estimated_value_aud).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {vaultTotalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
              <span className="text-sm text-muted-foreground">
                Page {vaultPage} of {vaultTotalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={vaultPage === 1 || vaultLoading}
                  onClick={() => fetchVaultRef.current?.(vaultPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={vaultPage === vaultTotalPages || vaultLoading}
                  onClick={() => fetchVaultRef.current?.(vaultPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Quick Actions Panel */}
        <Card className="shadow-sm border-border bg-card rounded-[1.5rem] h-fit">
          <CardHeader>
            <CardTitle className="font-serif">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild variant="outline" className="w-full justify-between h-14 rounded-xl border-border hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
              <Link to="/vault/add">
                <span className="font-bold text-foreground">Add Card to Vault</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between h-14 rounded-xl border-border hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
              <Link to="/account/profile">
                <span className="font-bold text-foreground">Edit Public Profile</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between h-14 rounded-xl border-border hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
              <Link to="/account/orders">
                <span className="font-bold text-foreground">My Orders</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between h-14 rounded-xl border-border hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
              <Link to="/account/membership">
                <span className="font-bold text-foreground">Membership &amp; Trial</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between h-14 rounded-xl border-border hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
              <Link to="/account/partner">
                <span className="font-bold text-foreground">Partner Dashboard</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between h-14 rounded-xl border-border hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
              <Link to="/marketplace">
                <span className="font-bold text-foreground">Browse Marketplace</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountDashboard;
