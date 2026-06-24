import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, Tags, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '@/lib/supabaseClient.js';
import { formatCurrency } from '@/utils/formatCurrency.js';

const ListingAnalyticsDashboard = ({ listings = [] }) => {
  const analytics = useMemo(() => {
    const total = listings.length;
    
    // Status breakdown (Simulated based on stockQuantity for officialCatalog)
    const inStock = listings.filter(l => l.stockQuantity > 0).length;
    const outOfStock = listings.filter(l => l.stockQuantity === 0).length;
    const needsModeration = listings.filter(l => l.moderationNotes?.length > 0).length;

    // Category breakdown
    const categories = listings.reduce((acc, curr) => {
      const cat = curr.collectionType || 'Other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const categoryData = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Recent listings
    const recent = [...listings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    return { total, inStock, outOfStock, needsModeration, categoryData, recent };
  }, [listings]);

  return (
    <div className="space-y-6 mb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Listings</CardTitle>
            <Package className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Catalog items</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active (In Stock)</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.inStock}</div>
            <p className="text-xs text-muted-foreground mt-1">Available for sale</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
            <Tags className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.outOfStock}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires restock</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Needs Moderation</CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.needsModeration}</div>
            <p className="text-xs text-muted-foreground mt-1">Has moderation notes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {analytics.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {analytics.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.15})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Items */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recently Added</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recent.length > 0 ? (
                analytics.recent.map(item => (
                  <div key={item.id} className="flex items-center gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {item.image_url || item.image ? (
                        <img src={item.image_url || item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.collectionType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(item.price * 100)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No recent listings found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ListingAnalyticsDashboard;