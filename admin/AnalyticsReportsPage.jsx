
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
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
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';

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

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch total counts efficiently using getList(1, 1)
        const [
          usersRes, 
          productsRes, 
          eventsRes, 
          categoriesRes, 
          brandsRes,
          ordersListRes
        ] = await Promise.all([
          pb.collection('users').getList(1, 1, { $autoCancel: false }),
          pb.collection('products').getList(1, 1, { $autoCancel: false }),
          pb.collection('events').getList(1, 1, { $autoCancel: false }),
          pb.collection('categories').getList(1, 1, { $autoCancel: false }),
          pb.collection('brands').getList(1, 1, { $autoCancel: false }),
          pb.collection('orders').getList(1, 10, { sort: '-created', expand: 'buyer_id', $autoCancel: false }).catch(() => ({ items: [], totalItems: 0 }))
        ]);

        // Fetch all orders and users for chart aggregation (in a real app, this would be a backend aggregation endpoint)
        // For this admin dashboard, we fetch the data to build the charts
        const allOrders = await pb.collection('orders').getFullList({ 
          filter: 'status != "cancelled"',
          fields: 'total_amount,created',
          $autoCancel: false 
        }).catch(() => []);

        const allUsers = await pb.collection('users').getFullList({
          fields: 'created',
          $autoCancel: false
        }).catch(() => []);

        const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        setStats({
          users: usersRes.totalItems || 0,
          products: productsRes.totalItems || 0,
          events: eventsRes.totalItems || 0,
          categories: categoriesRes.totalItems || 0,
          brands: brandsRes.totalItems || 0,
          orders: ordersListRes.totalItems || 0,
          revenue: totalRevenue
        });

        setRecentOrders(ordersListRes.items || []);

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
        allOrders.forEach(order => {
          const orderDate = new Date(order.created);
          const bucket = last6Months.find(m => m.month === orderDate.getMonth() && m.year === orderDate.getFullYear());
          if (bucket) {
            bucket.revenue += (order.total_amount || 0);
          }
        });

        // Aggregate Users
        allUsers.forEach(user => {
          const userDate = new Date(user.created);
          const bucket = last6Months.find(m => m.month === userDate.getMonth() && m.year === userDate.getFullYear());
          if (bucket) {
            bucket.users += 1;
          }
        });

        setChartData(last6Months);

      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
        setError("Failed to load analytics data. Please try again.");
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [timeRange]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8">
      <Helmet>
        <title>Analytics & Reports | Admin Portal</title>
      </Helmet>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="flex items-start gap-3 w-full sm:w-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted mt-0.5 shrink-0 px-3"
            aria-label="Go back to admin dashboard"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics & Reports</h1>
            <p className="text-muted-foreground mt-1">View detailed platform statistics, sales data, and user growth.</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-background border-border">
              <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button className="rounded-xl h-10 px-4 font-bold shadow-sm flex-1 sm:flex-none">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

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
          description="Lifetime platform revenue"
          loading={loading}
        />
        <StatCard 
          title="Total Orders" 
          value={stats.orders.toLocaleString()} 
          icon={ShoppingCart} 
          description="All processed orders"
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
          <Button variant="outline" className="rounded-xl h-9 px-4" onClick={() => navigate('/admin/marketplace')}>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{order.order_number || order.id}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(order.created).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {order.expand?.buyer_id?.email || order.buyer_id || 'Unknown User'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          order.status === 'delivered' || order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                          'bg-primary/10 text-primary'
                        }
                      >
                        {order.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_amount || 0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsReportsPage;
