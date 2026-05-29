
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Search, Filter, MoreHorizontal, Eye, RefreshCcw, ShoppingCart, ChevronLeft, AlertCircle, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const OrderManagementPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const isMounted = useRef(true);

  const fetchOrders = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*, buyer:profiles!buyer_id(id, display_name, username, email), seller:profiles!seller_id(id, display_name, username)').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      if (isMounted.current) setOrders(data ?? []);
    } catch (err) {
      if (isMounted.current) setError(err.message);
      toast.error("Failed to load orders.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchOrders();
    return () => { isMounted.current = false; };
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Order status updated to ${newStatus}`);
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (err) {
      toast.error("Failed to update order status.");
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.expand?.buyer_id?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8">
      <Helmet><title>Order Management | Admin</title></Helmet>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="h-10 rounded-xl px-3 mt-0.5 shrink-0">
            <ChevronLeft className="w-5 h-5 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Order Management</h1>
            <p className="text-muted-foreground text-sm mt-1">View and manage platform transactions.</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <Card className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by order number or buyer email..." 
              className="pl-9 h-10 rounded-xl bg-background border-border text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-background border-border">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto relative w-full">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground">Order #</TableHead>
                <TableHead className="font-semibold text-foreground">Date</TableHead>
                <TableHead className="font-semibold text-foreground">Buyer</TableHead>
                <TableHead className="font-semibold text-foreground">Amount</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <AlertCircle className="w-10 h-10 text-destructive mb-3 mx-auto" />
                    <p>Failed to load orders</p>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mb-3 mx-auto opacity-40" />
                    <p>No orders found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{order.order_number || order.id}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(order.created).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium text-foreground">{order.expand?.buyer_id?.email || 'Unknown'}</TableCell>
                    <TableCell className="tabular-nums font-medium">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                        order.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        'bg-primary/10 text-primary border-primary/20'
                      }>
                        {order.status || 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="cursor-pointer gap-2 font-medium">
                            <Eye className="w-4 h-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'shipped')} className="cursor-pointer gap-2 font-medium">
                            Mark as Shipped
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'cancelled')} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 font-medium">
                            Cancel Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default OrderManagementPage;
