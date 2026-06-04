
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Package, DollarSign, Star, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SellerDashboard = () => {
  const { currentUser } = useAuth();
  
  const [stats, setStats] = useState({
    productsListed: 0,
    totalSales: 0,
    avgRating: '0.0',
    totalRevenue: 0
  });
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  const fetchDashboardData = async () => {
    if (!currentUser?.id) {
      if (isMounted.current) setLoading(false);
      return;
    }

    try {
      setError(null);
      
      const [listingsRes, ordersRes, reviewsRes, cardsRes] = await Promise.all([
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', currentUser.id),
        supabase.from('orders').select('total_aud').eq('seller_id', currentUser.id).eq('status', 'completed'),
        supabase.from('reviews').select('rating').eq('reviewee_id', currentUser.id),
        supabase.from('vault_items').select('id, card_name, collection, listing_type, estimated_value_aud').eq('owner_id', currentUser.id).in('listing_type', ['fixed', 'trade', 'both']).order('updated_at', { ascending: false }).limit(50),
      ]);

      if (!isMounted.current) return;

      const orders = ordersRes.data ?? [];
      const revList = reviewsRes.data ?? [];
      const calculatedRevenue = orders.reduce((acc, t) => acc + (t.total_aud ?? 0), 0);
      const calculatedRating = revList.length > 0
        ? (revList.reduce((acc, r) => acc + (r.rating ?? 0), 0) / revList.length).toFixed(1)
        : '0.0';

      setStats({
        productsListed: listingsRes.count ?? 0,
        totalSales: orders.length,
        avgRating: calculatedRating,
        totalRevenue: calculatedRevenue,
      });

      const items = cardsRes.data ?? [];
      setCards(items.map(c => ({
        ...c,
        cardName: c.card_name,
        collectionType: c.collection,
        listingStatus: c.listing_type,
        askingPrice: c.estimated_value_aud,
      })));

    } catch (err) {
      console.error("Failed to fetch seller stats:", err);
      if (isMounted.current) setError("Failed to load seller statistics.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchDashboardData();

    const channel = supabase.channel(`seller-dashboard-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { if (isMounted.current) fetchDashboardData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (isMounted.current) fetchDashboardData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { if (isMounted.current) fetchDashboardData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_items' }, () => { if (isMounted.current) fetchDashboardData(); })
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const formattedRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(stats.totalRevenue);

  return (
    <div className="flex flex-col bg-background font-sans min-h-screen pb-20">
      <Helmet><title>Seller Dashboard | CardPop</title></Helmet>
      
      <div className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-2">Seller Dashboard</h1>
              <p className="text-muted-foreground text-lg">Manage your inventory and track your sales performance.</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => { setLoading(true); fetchDashboardData(); toast.success('Stats refreshed'); }}
              disabled={loading}
              className="rounded-xl shadow-sm self-start sm:self-auto h-11 px-6"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3 mb-8">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error loading dashboard</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="shadow-sm border-border hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</CardTitle>
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-9 w-24" /> : (
                  <div className="text-3xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formattedRevenue}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Completed Sales</CardTitle>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-9 w-16" /> : (
                  <div className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {stats.totalSales}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Products Listed</CardTitle>
                <Package className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-9 w-16" /> : (
                  <div className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {stats.productsListed}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Average Rating</CardTitle>
                <Star className="w-5 h-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-9 w-16" /> : (
                  <div className="text-3xl font-extrabold tabular-nums tracking-tight flex items-baseline gap-1">
                    <span className="text-foreground">{stats.avgRating}</span>
                    <span className="text-sm text-muted-foreground font-medium">/ 5.0</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Listings Table */}
          <div className="bg-card rounded-[2rem] border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/20">
              <h2 className="font-serif text-2xl font-bold text-foreground">Active Card Listings</h2>
            </div>
            
            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-8 space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-xl font-bold text-foreground mb-2">No active listings</p>
                  <p className="text-muted-foreground max-w-sm">You haven't listed any cards for sale or trade yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="p-4 sm:p-6 font-bold text-muted-foreground uppercase tracking-wider text-xs">Card Name</th>
                      <th className="p-4 sm:p-6 font-bold text-muted-foreground uppercase tracking-wider text-xs">Collection</th>
                      <th className="p-4 sm:p-6 font-bold text-muted-foreground uppercase tracking-wider text-xs">Status</th>
                      <th className="p-4 sm:p-6 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">Asking Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map(card => (
                      <tr key={card.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-4 sm:p-6 font-bold text-foreground">{card.cardName}</td>
                        <td className="p-4 sm:p-6 font-medium text-muted-foreground">{card.collectionType}</td>
                        <td className="p-4 sm:p-6">
                          <span className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
                            card.listingStatus === 'For Sale' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            card.listingStatus === 'For Trade' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            'bg-secondary/20 text-secondary-foreground'
                          }`}>
                            {card.listingStatus}
                          </span>
                        </td>
                        <td className="p-4 sm:p-6 tabular-nums font-bold text-right text-foreground">
                          {card.askingPrice ? `$${card.askingPrice.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
