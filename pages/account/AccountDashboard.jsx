
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, List, ArrowRightLeft, DollarSign, ArrowRight, AlertCircle, RefreshCw, PackageOpen, Award, Plus, CalendarDays } from 'lucide-react';
import SellerTierBadge from '@/components/SellerTierBadge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import AccountPlanBanner from '@/components/AccountPlanBanner.jsx';
import P2PTradingNotice from '@/components/P2PTradingNotice.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { uniqueTopic } from '@/lib/realtimeTopic.js';
import { useRefreshOnReturn } from '@/hooks/useRefreshOnReturn.js';
import { toast } from 'sonner';
import { todayInAustralia } from '@/utils/featuredPackages.js';
import { countMyEventBuckets, activeEventCount } from '@/utils/myEventStatus.js';

const AccountDashboard = () => {
  const { currentUser } = useAuth();
  const { settings } = usePlatformSettings();

  const [stats, setStats] = useState({
    salesCount: 0, revenue: 0, listingsCount: 0, vaultItemsCount: 0, pendingTrades: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sellerTier, setSellerTier] = useState(null);
  // Counts per lifecycle bucket of the events this user organises (null until
  // loaded, or when the read failed — the tile then shows a dash, not "0").
  const [eventCounts, setEventCounts] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(true);

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

    // Resolves true when every read succeeded. `silent` keeps the numbers on
    // screen while they refresh (returning to the tab) instead of skeletons.
    const run = async ({ silent = false } = {}) => {
      if (!silent) setStatsLoading(true);
      setStatsError(null);

      // Fetch seller tier independently — a missing profile row must not block stats
      supabase.from('profiles').select('seller_tier').eq('id', currentUser.id).maybeSingle()
        .then(({ data }) => { if (!cancelled && data) setSellerTier(data.seller_tier); })

      if (!silent) setEventsLoading(true);
      // The user's own events (RLS + organiser_id), three small columns each.
      // Independent of the stats batch so a failure here can't blank the rest.
      const eventsRead = supabase.from('events').select('status, start_date, end_date')
        .eq('organiser_id', currentUser.id).limit(500)
        .then(({ data, error }) => {
          if (cancelled) return;
          setEventsLoading(false);
          if (error) { console.error('Failed to load event stats:', error); setEventCounts(null); return false; }
          setEventCounts(countMyEventBuckets(data, todayInAustralia()));
          return true;
        })
        .catch((err) => { console.error('Failed to load event stats:', err); return false; });

      let statsOk = false;

      try {
        const [salesRes, listingsRes, vaultRes, tradesRes] = await Promise.all([
          // "Completed Sales" / "Total Revenue" are seller-side stats. Scoping
          // them to orders.seller_id missed every cart sale — a cart can span
          // multiple sellers, so those rows carry seller_id = NULL and the
          // seller lives inside each order_items line. seller_sales_summary()
          // resolves both shapes, and reports the seller's own proceeds rather
          // than orders.total_aud (what the *buyer* paid, commission and GST
          // included, which overstated revenue on every sale).
          supabase.rpc('seller_sales_summary'),
          supabase.from('listings').select('id', { count: 'exact', head: true })
            .eq('seller_id', currentUser.id).eq('status', 'active').neq('listing_type', 'vault'),
          supabase.from('vault_items').select('id', { count: 'exact', head: true })
            .eq('owner_id', currentUser.id),
          supabase.from('trades').select('id', { count: 'exact', head: true })
            .or(`initiator_id.eq.${currentUser.id},responder_id.eq.${currentUser.id}`)
            .eq('status', 'proposed'),
        ]);

        if (cancelled) return null;

        // Log individual errors without crashing the whole dashboard. Supabase
        // resolves (never rejects) a failed query, so a per-query error here
        // previously went unchecked — count/data falls back to 0/[] below,
        // silently rendering a real failure as "0 sales" / "$0 revenue"
        // instead of surfacing it.
        const namedResults = { sales: salesRes, listings: listingsRes, vault: vaultRes, trades: tradesRes };
        const failed = Object.entries(namedResults).filter(([, r]) => r.error);
        if (failed.length > 0) {
          failed.forEach(([name, r]) => console.error(`Failed to load ${name} stats:`, r.error));
          setStatsError('Some statistics failed to load — the numbers below may be incomplete. Try refreshing.');
        }

        // The RPC returns a single row: { completed_sales, revenue_aud }.
        const summary = Array.isArray(salesRes.data) ? salesRes.data[0] : salesRes.data;
        setStats({
          salesCount:      Number(summary?.completed_sales) || 0,
          revenue:         Number(summary?.revenue_aud) || 0,
          listingsCount:   listingsRes.count  || 0,
          vaultItemsCount: vaultRes.count    || 0,
          pendingTrades:   tradesRes.count   || 0,
        });
        statsOk = failed.length === 0;
      } catch (err) {
        if (!cancelled) setStatsError('Failed to load live statistics. Please try refreshing.');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
      const eventsOk = await eventsRead;
      if (cancelled) return null; // unmounted / user changed: no verdict
      return statsOk && eventsOk !== false;
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

    // Resolves true on success; `silent` as for the stats fetch.
    const run = async (page = vaultPage, { silent = false } = {}) => {
      if (!silent) { setVaultLoading(true); setVaultError(null); }
      try {
        const from = (page - 1) * 10;
        const { data: items, count, error: vaultFetchError } = await supabase
          .from('vault_items').select('*', { count: 'exact' })
          .eq('owner_id', uid)
          .order('created_at', { ascending: false })
          .range(from, from + 9);
        if (vaultFetchError) throw vaultFetchError;
        if (cancelled) return null;
        setVaultError(null);
        setVaultItems(items ?? []);
        setVaultPage(page);
        setVaultTotalPages(Math.ceil((count ?? 0) / 10));
        return true;
      } catch (err) {
        if (cancelled) return null;
        setVaultError(err.message || 'Failed to load vault items.');
        return false;
      } finally {
        if (!cancelled) setVaultLoading(false);
      }
    };

    fetchVaultRef.current = (page, opts) => run(page ?? vaultPageRef.current, opts);
    run(vaultPage);
    return () => { cancelled = true; };
  }, [currentUser?.id, vaultPage]);

  // ── Realtime subscription (stable — never torn down while user is logged in)
  // Every listener is filtered to this user's rows — unfiltered, any user's
  // write anywhere would refetch every logged-in dashboard. Tables where the
  // user can sit on either side (orders, trades) get one listener per column,
  // since postgres_changes filters can't express OR.
  // Each stats refetch is an RPC plus three exact counts, so a burst of events
  // (a bulk vault edit, a cart sale touching orders + listings + vault_items
  // at once) is coalesced into one refetch per table group instead of one per
  // row.
  useEffect(() => {
    if (!currentUser?.id) return;
    const uid = currentUser.id;
    let statsTimer = null;
    let vaultTimer = null;
    const refreshStats = () => {
      if (statsTimer) return;
      statsTimer = setTimeout(() => { statsTimer = null; fetchStatsRef.current?.(); }, 500);
    };
    const refreshVault = () => {
      if (vaultTimer) return;
      vaultTimer = setTimeout(() => { vaultTimer = null; fetchVaultRef.current?.(); }, 500);
    };
    const channel = supabase.channel(uniqueTopic(`dashboard-rt-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${uid}` }, refreshStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${uid}` }, refreshStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings', filter: `seller_id=eq.${uid}` }, refreshStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_items', filter: `owner_id=eq.${uid}` },
        () => { refreshStats(); refreshVault(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `organiser_id=eq.${uid}` }, refreshStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `initiator_id=eq.${uid}` }, refreshStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `responder_id=eq.${uid}` }, refreshStats)
      .subscribe();
    return () => {
      if (statsTimer) clearTimeout(statsTimer);
      if (vaultTimer) clearTimeout(vaultTimer);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  // Report what actually happened: the toast waits for the reads, and a
  // failed one says so instead of claiming success.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const [statsOk, vaultOk] = await Promise.all([
        fetchStatsRef.current?.() ?? true,
        fetchVaultRef.current?.() ?? true,
      ]);
      // null = the page went away mid-refresh: say nothing.
      if (statsOk === null || vaultOk === null) return;
      if (statsOk && vaultOk) toast.success('Dashboard refreshed');
      else toast.error('Some of your dashboard couldn’t be refreshed. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Realtime can't see everything — a deleted row arrives without the
  // owner column the listeners filter on (e.g. a draft event deleted in
  // another tab) — so refetch quietly whenever the user comes back to the
  // tab after a little while away.
  useRefreshOnReturn(() => {
    fetchStatsRef.current?.({ silent: true });
    fetchVaultRef.current?.(undefined, { silent: true });
  }, { staleMs: 15_000, enabled: !!currentUser?.id });

  const formattedRevenue = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(stats.revenue);

  return (
    <AccountPageShell
      documentTitle="Account Dashboard | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Dashboard' }]}
      title="Dashboard"
      description="Welcome back! Here's your live account overview."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || statsLoading || vaultLoading}
            className="rounded-xl shadow-sm h-10 px-4 font-bold transition-transform active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(refreshing || statsLoading || vaultLoading) ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          {/* Primary action, sitting to the right of Refresh Data. Adding a card
              is the thing most people land on the dashboard to do — on mobile the
              quick-action tiles further down are below the fold, so this needs to
              be in the header row. `primary` is --brand-red (see index.css). */}
          <Button
            asChild
            size="sm"
            className="rounded-xl shadow-sm h-10 px-4 font-bold transition-transform active:scale-95"
          >
            <Link to="/vault/add" className="gap-2">
              <Plus className="w-4 h-4" /> Add Card
            </Link>
          </Button>
        </>
      }
    >
      {statsError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold tracking-wide">Data Synchronization Error</p>
            <p className="text-sm opacity-90">{statsError}</p>
          </div>
        </div>
      )}

      {/* Peer-to-peer trading launch notice (coming late 2026) */}
      <P2PTradingNotice />

      {/* Plan status + next-step nudges (Hobby vs Pro) */}
      <AccountPlanBanner />

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Events</CardTitle>
            <CalendarDays className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {eventsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
                {eventCounts ? activeEventCount(eventCounts) : '—'}
              </div>
            )}
            {eventCounts && (eventCounts.pending > 0 || eventCounts.draft > 0) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[
                  eventCounts.pending > 0 && `${eventCounts.pending} pending approval`,
                  eventCounts.draft > 0 && `${eventCounts.draft} draft${eventCounts.draft === 1 ? '' : 's'}`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            <Link
              to={eventCounts?.all === 0 ? '/account/events?new=1' : '/account/events'}
              className="text-xs font-bold text-primary hover:underline mt-2 inline-block"
            >
              {eventCounts?.all === 0 ? 'List an event' : 'View all events'} &rarr;
            </Link>
          </CardContent>
        </Card>

        {settings.enable_trading !== false && (
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
        )}

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
              <Link to="/account/sole-trader">
                <span className="font-bold text-foreground">Sole Trader Store</span>
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
    </AccountPageShell>
  );
};

export default AccountDashboard;
