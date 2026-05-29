
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, Package, DollarSign, Activity, AlertCircle, 
  ArrowUpRight, Server, Database, HardDrive, CheckCircle2,
  FolderTree, RefreshCw, ArrowRightLeft, Calendar,
  Tags, BarChart3, Building2, Layers, ShieldCheck, Lock, ShoppingCart, Filter, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbaseClient.js';
import { useAdmin } from '@/contexts/AdminContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCategories } from '@/hooks/useCategories.js';
import { toast } from 'sonner';
import VaultListingModal from '@/components/VaultListingModal.jsx';

const StatCard = ({ title, value, icon: Icon, trend, description, loading }) => (
  <Card className="shadow-sm border-border hover:border-primary/40 transition-colors">
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
        </p>
      )}
    </CardContent>
  </Card>
);

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
  const { buildNameMap, getCategories, getSubcategoriesByCategory, getBrandsBySubcategory, getSeriesByBrand } = useCategories();
  
  const [stats, setStats] = useState({ users: 0, listings: 0, revenue: 0, activeTrades: 0 });
  const [health, setHealth] = useState(null);
  const [vaultProducts, setVaultProducts] = useState([]);
  const [filteredCount, setFilteredCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Category Filtering
  const [nameMap, setNameMap] = useState({});
  const [filterCat, setFilterCat] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterListingType, setFilterListingType] = useState('');
  
  const [catOpts, setCatOpts] = useState([]);
  const [subOpts, setSubOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);
  const [seriesOpts, setSeriesOpts] = useState([]);

  const isMounted = useRef(true);

  // Init Data and Map
  useEffect(() => {
    const init = async () => {
      const map = await buildNameMap();
      if(isMounted.current) setNameMap(map);
      const rootCats = await getCategories();
      if(isMounted.current) setCatOpts(rootCats);
    };
    if (isAdmin) init();
  }, [buildNameMap, getCategories, isAdmin]);

  // Cascade Filtering
  useEffect(() => {
    if (filterCat) getSubcategoriesByCategory(filterCat).then(setSubOpts);
    else { setSubOpts([]); setFilterSub(''); }
  }, [filterCat, getSubcategoriesByCategory]);

  useEffect(() => {
    if (filterSub) getBrandsBySubcategory(filterSub).then(setBrandOpts);
    else { setBrandOpts([]); setFilterBrand(''); }
  }, [filterSub, getBrandsBySubcategory]);

  useEffect(() => {
    if (filterBrand) getSeriesByBrand(filterBrand).then(setSeriesOpts);
    else { setSeriesOpts([]); setFilterSeries(''); }
  }, [filterBrand, getSeriesByBrand]);

  const fetchDashboardData = async () => {
    if (!isAdmin) {
      setError("Unauthorized access. Administrator privileges required.");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      let vaultFilter = '';
      const filters = [];
      if (filterCat) filters.push(`categoryId="${filterCat}"`);
      if (filterSub) filters.push(`subcategoryId="${filterSub}"`);
      if (filterBrand) filters.push(`brandId="${filterBrand}"`);
      if (filterSeries) filters.push(`seriesId="${filterSeries}"`);
      if (filterListingType) filters.push(`listing_type="${filterListingType}"`);
      if (filters.length > 0) vaultFilter = filters.join(' && ');

      const [usersRes, transRes, tradesRes, sysHealth, vaultRes] = await Promise.all([
        pb.collection('users').getList(1, 1, { $autoCancel: false }).catch(() => ({ totalItems: 0 })),
        pb.collection('transactions').getFullList({ filter: `status="Completed"`, $autoCancel: false }).catch(() => []),
        pb.collection('tradeRequests').getList(1, 1, { filter: `status="Pending"`, $autoCancel: false }).catch(() => ({ totalItems: 0 })),
        getSystemHealth().catch(() => ({ database: 'Error', storage: 'Error', api: 'Error', uptime: 'Unknown' })),
        pb.collection('user_vaults').getList(1, 20, { 
          filter: vaultFilter, 
          sort: '-created', 
          expand: 'user_id', 
          $autoCancel: false 
        }).catch(() => ({ items: [], totalItems: 0 }))
      ]);
      
      if (!isMounted.current) return;

      const calculatedRevenue = transRes.reduce((acc, t) => acc + (t.transactionValue || 0), 0);

      setStats(prev => ({
        ...prev,
        users: usersRes.totalItems || 0,
        revenue: calculatedRevenue,
        activeTrades: tradesRes.totalItems || 0
      }));

      setHealth(sysHealth);
      setVaultProducts(vaultRes.items || []);
      setFilteredCount(vaultRes.totalItems || 0);
    } catch (err) {
      console.error("Admin Dashboard fetch error:", err);
      if (isMounted.current) setError("Failed to load dashboard data.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    if (isAdmin) fetchDashboardData();
    else setLoading(false);
    return () => { isMounted.current = false; };
  }, [isAdmin, getSystemHealth, filterCat, filterSub, filterBrand, filterSeries, filterListingType]);

  const clearFilters = () => {
    setFilterCat('');
    setFilterSub('');
    setFilterBrand('');
    setFilterSeries('');
    setFilterListingType('');
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
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif tracking-tight text-foreground mb-2">Platform Overview</h1>
          <p className="text-muted-foreground text-lg">System metrics and live administrative data.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); fetchDashboardData(); }} disabled={loading} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={stats.users.toLocaleString()} icon={Users} loading={loading} />
        <StatCard title="Active Trades" value={stats.activeTrades.toLocaleString()} icon={ArrowRightLeft} loading={loading} />
        <StatCard title="Total Revenue" value={`$${stats.revenue.toLocaleString()}`} icon={DollarSign} loading={loading} />
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
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-serif font-bold text-foreground">Core Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ManagementBox title="Product Management" description="Oversee official catalog." icon={Package} link="/admin/products" />
          <ManagementBox title="Brands Management" description="Add game and sports brands." icon={Building2} link="/admin/brands" />
          <ManagementBox title="Category Management" description="Organize top-level categories." icon={FolderTree} link="/admin/categories" />
          <ManagementBox title="User Management" description="Review accounts and roles." icon={Users} link="/admin/users" />
        </div>
      </div>

      {/* User Vault Data Filtered view */}
      <Card className="border-border shadow-sm bg-card rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-serif text-xl">User Vault Products Tracker</CardTitle>
              <CardDescription>Filter community vault items by hierarchy category</CardDescription>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={filterListingType} onValueChange={setFilterListingType}>
                <SelectTrigger className="w-[150px] bg-background text-xs h-9 rounded-lg"><SelectValue placeholder="Listing Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="For Sale">For Sale</SelectItem>
                  <SelectItem value="For Trade">For Trade</SelectItem>
                  <SelectItem value="For Sale & Trade">For Sale &amp; Trade</SelectItem>
                  <SelectItem value="Private">Private</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-[140px] bg-background text-xs h-9 rounded-lg"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSub} onValueChange={setFilterSub} disabled={!filterCat}>
                <SelectTrigger className="w-[140px] bg-background text-xs h-9 rounded-lg"><SelectValue placeholder="Subcategory" /></SelectTrigger>
                <SelectContent>{subOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterBrand} onValueChange={setFilterBrand} disabled={!filterSub}>
                <SelectTrigger className="w-[140px] bg-background text-xs h-9 rounded-lg"><SelectValue placeholder="Brand" /></SelectTrigger>
                <SelectContent>{brandOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSeries} onValueChange={setFilterSeries} disabled={!filterBrand}>
                <SelectTrigger className="w-[140px] bg-background text-xs h-9 rounded-lg"><SelectValue placeholder="Series" /></SelectTrigger>
                <SelectContent>{seriesOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {(filterListingType || filterCat || filterSub || filterBrand || filterSeries) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground"><X className="w-4 h-4" /></Button>
              )}
            </div>
          </div>
          {(filterListingType || filterCat || filterSub || filterBrand || filterSeries) && (
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
                  const path = [nameMap[vp.categoryId], nameMap[vp.subcategoryId], nameMap[vp.brandId], nameMap[vp.seriesId]].filter(Boolean).join(' > ');
                  return (
                    <TableRow key={vp.id}>
                      <TableCell className="font-bold px-6">{vp.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{vp.expand?.user_id?.email || vp.user_id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={path}>{path || 'Uncategorized'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-bold shadow-sm ${
                          vp.listing_type === 'For Sale'          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' :
                          vp.listing_type === 'For Trade'         ? 'bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400' :
                          vp.listing_type === 'For Sale & Trade'  ? 'bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-400' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>{vp.listing_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">${(vp.price || 0).toFixed(2)}</TableCell>
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
        onUpdate={() => { setLoading(true); fetchDashboardData(); }}
      />
    </div>
  );
};

export default AdminDashboard;
