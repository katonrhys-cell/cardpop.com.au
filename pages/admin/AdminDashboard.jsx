
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Package, DollarSign, Activity, AlertCircle,
  ArrowUpRight, Server, Database, HardDrive, CheckCircle2,
  FolderTree, RefreshCw, ArrowRightLeft, Calendar,
  Tags, BarChart3, Building2, Layers, ShieldCheck, Lock, ShoppingCart, ShoppingBag, Filter, X,
  Settings, Image, Store, Map, FileText, Wrench, ListOrdered, Layers2, LayoutDashboard, Star, Sparkles, LayoutList, Flag, CreditCard, MessagesSquare, Handshake, Rocket, Tv2, HandCoins, TicketPercent, MessageSquareText, ClipboardPen, Gift } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { useAdmin } from '@/contexts/AdminContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCategories } from '@/hooks/useCategories.js';
import { toast } from 'sonner';
import VaultListingModal from '@/components/VaultListingModal.jsx';
import { PAID_ORDER_STATUSES, SETTLED_REFUND_STATUSES, summariseRevenue, formatAud } from '@/utils/revenue.js';
import ShopProductForm from '@/components/ShopProductForm.jsx';
import SiteTrafficCard from '@/components/admin/SiteTrafficCard.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// `to` turns the whole card into a link through to the detail view behind the
// number (e.g. Total Revenue → the sales ledger it was summed from).
const StatCard = ({ title, value, icon: Icon, trend, description, loading, to }) => {
  const card = (
    <Card className={`shadow-sm border-border hover:border-primary/40 transition-colors h-full ${to ? 'group cursor-pointer hover:shadow-md' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <Icon className="w-5 h-5 text-primary" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24 mb-2" />
        ) : (
          <div className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</div>
        )}
        {(trend || description) && !loading && (
          <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center">
            {trend && <span className="text-emerald-500 inline-flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded mr-2"><ArrowUpRight className="w-3 h-3 mr-0.5"/>{trend}</span>}
            {description && <span>{description}</span>}
            {to && <ArrowUpRight className="w-3.5 h-3.5 ml-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return to ? <Link to={to} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{card}</Link> : card;
};

const ManagementBox = ({ title, description, icon: Icon, link }) => (
  <Card className="shadow-sm border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 group h-full flex flex-col">
    <CardHeader className="pb-3">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <CardTitle className="font-serif text-xl">{title}</CardTitle>
      <CardDescription className="text-sm mt-1">{description}</CardDescription>
    </CardHeader>
    <CardContent className="mt-auto pt-4">
      <Button asChild variant="outline" className="w-full rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Link to={link}>Manage {title.split(' ')[0]}</Link>
      </Button>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const { getSystemHealth, isAdmin } = useAdmin();
  const { currentUser } = useAuth();
  const { buildNameMap, getCategories } = useCategories();
  
  const [stats, setStats] = useState({ users: 0, listings: 0, revenue: 0, activeTrades: 0 });
  const [health, setHealth] = useState(null);
  const [vaultProducts, setVaultProducts] = useState([]);
  const [filteredCount, setFilteredCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  
  // Category Filtering
  const [nameMap, setNameMap] = useState({});
  const [filterCat, setFilterCat] = useState('');

  const [catOpts, setCatOpts] = useState([]);

  const fetchRef = useRef(null);

  // Init Data and Map
  useEffect(() => {
    const init = async () => {
      const map = await buildNameMap();
      setNameMap(map);
      const rootCats = await getCategories();
      setCatOpts(rootCats);
    };
    if (isAdmin) init();
  }, [buildNameMap, getCategories, isAdmin]);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        let vaultQuery = supabase
          .from('vault_items')
          .select('*, profiles!vault_items_owner_id_fkey(display_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(0, 19);

        if (filterCat) vaultQuery = vaultQuery.eq('category_id', filterCat);

        const [usersRes, ordersRes, refundsRes, tradesRes, sysHealth, vaultRes] = await Promise.all([
          Promise.resolve(supabase.from('profiles').select('id', { count: 'exact', head: true })).catch(() => ({ count: 0 })),
          Promise.resolve(supabase.from('orders').select('id, total_aud, status').in('status', PAID_ORDER_STATUSES)).catch(() => ({ data: [] })),
          Promise.resolve(supabase.from('refunds').select('order_id, status, refund_amount_aud').in('status', SETTLED_REFUND_STATUSES)).catch(() => ({ data: [] })),
          Promise.resolve(supabase.from('listings').select('*', { count: 'exact' }).eq('status', 'active').limit(1)).catch(() => ({ count: 0 })),
          getSystemHealth().catch(() => ({ database: 'OK', storage: 'OK', api: 'OK', uptime: 'Unknown' })),
          Promise.resolve(vaultQuery).catch(() => ({ data: [], count: 0 }))
        ]);

        if (cancelled) return;

        // Supabase queries resolve with { error } rather than rejecting, so the
        // per-query .catch() above never fires. Log any partial-load errors so a
        // false "0" stat isn't completely silent (a full failure still hits the
        // catch below and shows the error screen).
        const loadErrors = [usersRes.error, ordersRes.error, refundsRes.error, tradesRes.error, vaultRes.error].filter(Boolean);
        if (loadErrors.length) console.error('[AdminDashboard] partial load errors:', loadErrors);

        // Headline revenue is net: what the buyers paid, less refunds actually
        // issued. Same definition as /admin/revenue, which this card links to —
        // the two must never disagree.
        const calculatedRevenue = summariseRevenue(ordersRes.data || [], refundsRes.data || []).net;

        setStats(prev => ({
          ...prev,
          users: usersRes.count || 0,
          revenue: calculatedRevenue,
          activeTrades: tradesRes.count || 0
        }));

        setHealth(sysHealth);
        setVaultProducts(vaultRes.data || []);
        setFilteredCount(vaultRes.count || 0);
      } catch (err) {
        if (!cancelled) setError("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [isAdmin, getSystemHealth, filterCat]);

  const clearFilters = () => {
    setFilterCat('');
  };

  const handleEditStatus = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => fetchRef.current?.()} className="w-full rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">Quick Navigation</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Events', link: '/admin/events' },
                { label: 'Users', link: '/admin/users' },
                { label: 'Verification', link: '/admin/verification' },
                { label: 'Reports', link: '/admin/reports' },
                { label: 'Orders', link: '/admin/orders' },
                { label: 'Categories', link: '/admin/categories' },
                { label: 'Settings', link: '/admin/settings' },
              ].map(({ label, link }) => (
                <Button key={link} asChild variant="outline" size="sm" className="rounded-lg">
                  <Link to={link}>{label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <AdminPageHeader
        icon={LayoutDashboard}
        title="Platform Overview"
        subtitle="System metrics and live administrative data."
        showBack={false}
      >
        <Button variant="outline" onClick={() => setIsShopModalOpen(true)} className="rounded-xl font-bold h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <ShoppingCart className="w-4 h-4 mr-2" /> Add to Shop
        </Button>
        <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={stats.users.toLocaleString()} icon={Users} loading={loading} />
        <StatCard title="Active Trades" value={stats.activeTrades.toLocaleString()} icon={ArrowRightLeft} loading={loading} />
        <StatCard
          title="Total Revenue"
          value={formatAud(stats.revenue)}
          icon={DollarSign}
          description="View full breakdown"
          loading={loading}
          to="/admin/revenue"
        />
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Health</CardTitle>
            <Activity className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-2" /> : (
              <div className="text-xl font-bold text-foreground flex flex-col gap-1 mt-1">
                <span className="text-emerald-500 text-sm flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> API: {health?.api || 'OK'}</span>
                <span className="text-emerald-500 text-sm flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> DB: {health?.database || 'OK'}</span>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Visitors from Google Analytics (docs/site-traffic.md) — spans the
            row so the 30-day sparkline has room. */}
        <div className="md:col-span-2 lg:col-span-4">
          <SiteTrafficCard />
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-serif font-bold text-foreground">Core Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ManagementBox title="Shop Management" description="Add, edit and manage shop products." icon={ShoppingCart} link="/admin/products" />
          <ManagementBox title="Shop Affiliate Products" description="Manage Amazon affiliate products shown at the bottom of the shop pages." icon={ShoppingBag} link="/admin/shop-affiliate-products" />
          <ManagementBox title="Brands Management" description="Add game and sports brands." icon={Building2} link="/admin/brands" />
          <ManagementBox title="Category Management" description="Organize top-level categories." icon={FolderTree} link="/admin/categories" />
          <ManagementBox title="Subcategory Management" description="Manage nested subcategories." icon={Layers2} link="/admin/subcategories" />
          <ManagementBox title="Product Lines" description="Manage product lines per brand." icon={Layers} link="/admin/product-lines" />
          <ManagementBox title="Collections & Eras" description="Manage eras and sets per collection." icon={Layers} link="/admin/collections" />
          <ManagementBox title="User Management" description="Review accounts and roles." icon={Users} link="/admin/users" />
          <ManagementBox title="Sellers Management" description="Manage featured sellers and promotions." icon={Star} link="/admin/sellers" />
          <ManagementBox title="Order Management" description="Track and manage all orders." icon={ListOrdered} link="/admin/orders" />
          <ManagementBox title="Verification" description="Review user verification requests." icon={ShieldCheck} link="/admin/verification" />
          <ManagementBox title="Reports & Moderation" description="Triage scam, counterfeit and abuse reports." icon={Flag} link="/admin/reports" />
          <ManagementBox title="Chat Moderation" description="Search and review member conversations." icon={MessagesSquare} link="/admin/messages" />
          <ManagementBox title="Offers" description="Every marketplace offer — open, awaiting payment, paid or lapsed." icon={HandCoins} link="/admin/offers" />
          <ManagementBox title="Chargebacks" description="Review payment disputes and frozen payouts." icon={CreditCard} link="/admin/disputes" />
          <ManagementBox title="Revenue Breakdown" description="Every sale behind total revenue — dates, amounts, fees and GST." icon={DollarSign} link="/admin/revenue" />
          <ManagementBox title="Finance & Tax" description="Profit on shop sales, GST by BAS quarter, stock valuation and accountant exports." icon={DollarSign} link="/admin/finance" />
          <ManagementBox title="Commissions & Revenue" description="Manage fee rates and view revenue reports." icon={DollarSign} link="/admin/commissions" />
          <ManagementBox title="Partner Program" description="Review partner applications, set rates and pay commissions." icon={Handshake} link="/admin/partners" />
          <ManagementBox title="Promo Codes" description="Create % off codes, set expiry and limits, note who has them and see every use." icon={TicketPercent} link="/admin/promo-codes" />
          <ManagementBox title="Players" description="The athletes with a public player page: bios, key cards, aliases and publish state." icon={Users} link="/admin/players" />
          <ManagementBox title="Product Reviews" description="Approve verified-purchase shop reviews before they go live." icon={MessageSquareText} link="/admin/product-reviews" />
          <ManagementBox title="Giveaways" description="Instagram giveaways: prizes, entries, comment verification and the recorded random draw." icon={Gift} link="/admin/giveaways" />
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-serif font-bold text-foreground">Content &amp; Platform</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ManagementBox title="Marketplace" description="Manage marketplace listings." icon={Store} link="/admin/marketplace" />
          <ManagementBox title="Business Profiles" description="Curate retail storefronts shown on the Retailers directory and map." icon={Building2} link="/admin/business-profiles" />
          <ManagementBox title="Building Your Business" description="Manage affiliate tools shown on the Community business page." icon={Rocket} link="/admin/building-your-business" />
          <ManagementBox title="Category Mapping" description="Map categories to collections." icon={Map} link="/admin/category-mapping" />
          <ManagementBox title="Events Management" description="Create and manage events." icon={Calendar} link="/admin/events" />
          <ManagementBox title="Whatnot Shows" description="Moderate member-listed Whatnot live shows." icon={Tv2} link="/admin/whatnot-shows" />
          <ManagementBox title="Content Management" description="Edit blog, pages and articles." icon={FileText} link="/admin/content" />
          <ManagementBox title="Event Reviews" description="Write and publish reviews of the shows CardPop attends." icon={ClipboardPen} link="/admin/event-reviews" />
          <ManagementBox title="Hero Showcase" description="Manage cards in the homepage hero animation." icon={Sparkles} link="/admin/hero-showcase" />
          <ManagementBox title="Collection Sections" description="Pin cards to collection page strips." icon={LayoutList} link="/admin/collection-sections" />
          <ManagementBox title="Media Library" description="Upload and manage images." icon={Image} link="/admin/media" />
          <ManagementBox title="Card Art" description="Upload thumbnails for sports cards and override card art in analytics." icon={Image} link="/admin/card-art" />
          <ManagementBox title="Analytics & Reports" description="View platform analytics." icon={BarChart3} link="/admin/analytics" />
          <ManagementBox title="System Diagnostics" description="Monitor system health." icon={Wrench} link="/admin/diagnostics" />
          <ManagementBox title="Admin Settings" description="Configure platform settings." icon={Settings} link="/admin/settings" />
        </div>
      </div>

      {/* User Vault Data Filtered view */}
      <Card className="border-border shadow-sm bg-card rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-serif text-xl">User Vault Products Tracker</CardTitle>
              <CardDescription>Filter community vault items by category</CardDescription>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-[140px] bg-background text-xs h-9 rounded-lg"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {filterCat && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground"><X className="w-4 h-4" /></Button>
              )}
            </div>
          </div>
          {filterCat && (
             <div className="mt-2 text-sm font-bold text-primary bg-primary/5 inline-block px-3 py-1 rounded-md">
               {filteredCount} item{filteredCount !== 1 ? 's' : ''} match{filteredCount === 1 ? 'es' : ''} current filters
             </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="font-semibold px-6">Product Name</TableHead>
                <TableHead className="font-semibold">Owner</TableHead>
                <TableHead className="font-semibold">Hierarchy Path</TableHead>
                <TableHead className="font-semibold">Listing Status</TableHead>
                <TableHead className="font-semibold text-right">Price</TableHead>
                <TableHead className="px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6} className="px-6"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : vaultProducts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No vault products found for this filter.</TableCell></TableRow>
              ) : (
                vaultProducts.map((vp) => {
                  const path = [nameMap[vp.category_id]].filter(Boolean).join(' > ');
                  const ownerProfile = vp.profiles;
                  const ownerDisplay = ownerProfile?.display_name || vp.owner_id;
                  return (
                    <TableRow key={vp.id}>
                      <TableCell className="font-bold px-6">{vp.card_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{ownerDisplay}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={path}>{path || 'Uncategorized'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-bold shadow-sm ${
                          vp.listing_type === 'For Sale'          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' :
                          vp.listing_type === 'For Trade'         ? 'bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400' :
                          vp.listing_type === 'For Sale & Trade'  ? 'bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-400' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>{vp.listing_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">${(Number(vp.estimated_value_aud) || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right px-6">
                        <Button variant="ghost" size="sm" onClick={() => handleEditStatus(vp)} className="text-xs">Manage Status</Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <VaultListingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={selectedProduct}
        onUpdate={() => fetchRef.current?.()}
      />

      <Dialog open={isShopModalOpen} onOpenChange={setIsShopModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border-border p-0">
          <div className="p-8">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl font-bold font-serif text-foreground">Add Shop Product</DialogTitle>
            </DialogHeader>
            <ShopProductForm
              product={null}
              onSuccess={() => { setIsShopModalOpen(false); toast.success('Product added to shop!'); }}
              onCancel={() => setIsShopModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
