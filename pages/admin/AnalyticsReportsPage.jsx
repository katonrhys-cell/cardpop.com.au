
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ChevronLeft,
  Users,
  DollarSign,
  Package,
  Download,
  Calendar as CalendarIcon,
  ArrowUpRight,
  CalendarDays,
  FolderTree,
  Building2,
  ShoppingCart,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import OrderDetailDialog from '@/components/admin/OrderDetailDialog.jsx';

// Orders sit in 'pending' until Stripe confirms payment, and can end in
// 'payment_failed'/'cancelled' without money ever changing hands — none of
// those are real revenue, so the report only counts orders that actually paid.
const PAID_STATUSES = ['payment_confirmed', 'shipped', 'completed', 'refunded'];

const StatCard = ({ title, value, icon: Icon, description, loading }) => (
  <Card className="shadow-sm border-border hover:border-primary/40 transition-colors">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24 mb-2" />
      ) : (
        <div className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</div>
      )}
      <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center">
        {description}
      </p>
    </CardContent>
  </Card>
);

const AnalyticsReportsPage = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('6m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [stats, setStats] = useState({
    revenue: 0,
    users: 0,
    products: 0,
    events: 0,
    categories: 0,
    brands: 0,
    orders: 0
  });
  
  const [chartData, setChartData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [viewOrderId, setViewOrderId] = useState(null);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch total counts
        const [
          usersRes,
          listingsRes,
          eventsRes,
          categoriesRes,
          ordersCountRes,
          recentOrdersRes,
          allOrdersRes,
          allUsersRes
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('listings').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase.from('categories').select('*', { count: 'exact', head: true }),
          supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', PAID_STATUSES),
          supabase.from('orders').select('*, profiles!orders_buyer_id_fkey(username, display_name)').order('created_at', { ascending: false }).range(0, 9),
          supabase.from('orders').select('total_aud,created_at').in('status', PAID_STATUSES),
          supabase.from('profiles').select('created_at')
        ]);

        // Surface a partial failure instead of silently rendering zeros: if any
        // query errored, treat the whole report as failed so the error UI shows.
        const loadError = [
          usersRes.error, listingsRes.error, eventsRes.error, categoriesRes.error,
          ordersCountRes.error, recentOrdersRes.error, allOrdersRes.error, allUsersRes.error,
        ].find(Boolean);
        if (loadError) throw loadError;

        const totalRevenue = (allOrdersRes.data || []).reduce((sum, order) => sum + (order.total_aud || 0), 0);

        setStats({
          users: usersRes.count || 0,
          products: listingsRes.count || 0,
          events: eventsRes.count || 0,
          categories: categoriesRes.count || 0,
          brands: 0,
          orders: ordersCountRes.count || 0,
          revenue: totalRevenue
        });

        setRecentOrders(recentOrdersRes.data || []);

        // Build Chart Data (Last 6 Months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const last6Months = [];
        const d = new Date();

        for (let i = 5; i >= 0; i--) {
          const d2 = new Date(d.getFullYear(), d.getMonth() - i, 1);
          last6Months.push({
            name: months[d2.getMonth()],
            month: d2.getMonth(),
            year: d2.getFullYear(),
            revenue: 0,
            users: 0
          });
        }

        // Aggregate Orders
        (allOrdersRes.data || []).forEach(order => {
          const orderDate = new Date(order.created_at);
          const bucket = last6Months.find(m => m.month === orderDate.getMonth() && m.year === orderDate.getFullYear());
          if (bucket) {
            bucket.revenue += (order.total_aud || 0);
          }
        });

        // Aggregate Users
        (allUsersRes.data || []).forEach(user => {
          const userDate = new Date(user.created_at);
          const bucket = last6Months.find(m => m.month === userDate.getMonth() && m.year === userDate.getFullYear());
          if (bucket) {
            bucket.users += 1;
          }
        });

        setChartData(last6Months);

      } catch (err) {
        setError("Failed to load analytics data. Please try again.");
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [timeRange]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleExport = () => {
    // Export the metrics already loaded on this page as a CSV the admin can
    // open in a spreadsheet. Guards against exporting a blank/failed report.
    if (loading || error) return;

    const csvCell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue (AUD)', stats.revenue],
      ['Total Orders', stats.orders],
      ['Total Users', stats.users],
      ['Products', stats.products],
      ['Categories', stats.categories],
      ['Events', stats.events],
      [],
      ['Recent Orders'],
      ['Order ID', 'Date', 'Buyer', 'Status', 'Amount (AUD)'],
      ...recentOrders.map((o) => [
        o.order_number || o.id,
        new Date(o.created_at).toLocaleDateString('en-AU'),
        o.profiles?.display_name || o.profiles?.username || o.buyer_id || 'Unknown User',
        o.status || 'Pending',
        o.total_aud || 0,
      ]),
    ];

    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cardpop-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Analytics exported');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Analytics & Reports | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={BarChart3}
        title="Analytics & Reports"
        subtitle="View detailed platform statistics, sales data, and user growth."
      >
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] h-10 rounded-xl border-white/20 bg-white/10 text-white">
            <CalendarIcon className="w-4 h-4 mr-2 text-white/60" />
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handleExport}
          disabled={loading || !!error}
          className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </AdminPageHeader>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.revenue)}
          icon={DollarSign}
          description="Lifetime revenue from paid orders"
          loading={loading}
        />
        <StatCard
          title="Total Orders"
          value={stats.orders.toLocaleString()}
          icon={ShoppingCart}
          description="Paid orders (excludes pending)"
          loading={loading}
        />
        <StatCard 
          title="Total Users" 
          value={stats.users.toLocaleString()} 
          icon={Users} 
          description="Registered accounts"
          loading={loading}
        />
        <StatCard 
          title="Products" 
          value={stats.products.toLocaleString()} 
          icon={Package} 
          description="Active catalog items"
          loading={loading}
        />
        <StatCard 
          title="Categories" 
          value={stats.categories.toLocaleString()} 
          icon={FolderTree} 
          description="Product categories"
          loading={loading}
        />
        <StatCard 
          title="Events" 
          value={stats.events.toLocaleString()} 
          icon={CalendarDays} 
          description="Community events"
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/10 pb-4">
            <CardTitle className="text-lg font-bold">Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue generation across all channels</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              {loading ? (
                <Skeleton className="w-full h-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={(value) => [formatCurrency(value), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/10 pb-4">
            <CardTitle className="text-lg font-bold">User Growth</CardTitle>
            <CardDescription>New user registrations over time</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              {loading ? (
                <Skeleton className="w-full h-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={(value) => [value.toLocaleString(), 'New Users']}
                    />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card className="border-border shadow-sm rounded-xl overflow-hidden w-full">
        <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Orders</h3>
            <p className="text-sm text-muted-foreground">Latest transactions across the platform</p>
          </div>
          <Button variant="outline" className="rounded-xl h-9 px-4" onClick={() => navigate('/admin/orders')}>
            View All
          </Button>
        </div>
        
        <div className="overflow-x-auto relative w-full">
          <Table className="w-full">
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-foreground">Order ID</TableHead>
                <TableHead className="font-bold text-foreground">Date</TableHead>
                <TableHead className="font-bold text-foreground">Buyer</TableHead>
                <TableHead className="font-bold text-foreground">Status</TableHead>
                <TableHead className="text-right font-bold text-foreground">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No recent orders found.
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.map((order) => (
                  <TableRow key={order.id} className="group hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => setViewOrderId(order.id)}
                        className="text-primary hover:underline underline-offset-2"
                      >
                        {order.order_number || order.id}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {order.profiles?.display_name || order.profiles?.username || order.buyer_id || 'Unknown User'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                          'bg-primary/10 text-primary'
                        }
                      >
                        {order.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_aud || 0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {viewOrderId && (
        <OrderDetailDialog orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
      )}
    </div>
  );
};

export default AnalyticsReportsPage;
