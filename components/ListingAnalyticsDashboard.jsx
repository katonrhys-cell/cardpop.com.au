import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, Tags, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toCdnUrl } from '@/utils/imageUrl.js';

// listings.price_aud is stored in whole dollars — format directly (the shared
// utils/formatCurrency helper expects cents + a currency descriptor).
const formatAud = (dollars) => `$${(Number(dollars) || 0).toFixed(2)}`;

const ListingAnalyticsDashboard = ({ listings = [] }) => {
  const analytics = useMemo(() => {
    const total = listings.length;

    // A listing is a single item — its lifecycle is tracked by `status`, and
    // moderation by the `flagged` flag (there is no per-listing stock count).
    const active = listings.filter(l => l.status === 'active').length;
    const sold = listings.filter(l => l.status === 'sold').length;
    const needsModeration = listings.filter(l => l.flagged).length;

    // Breakdown by lifecycle status.
    const statuses = listings.reduce((acc, curr) => {
      const key = curr.status || 'unknown';
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const categoryData = Object.entries(statuses)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Recent listings
    const recent = [...listings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    return { total, active, sold, needsModeration, categoryData, recent };
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.active}</div>
            <p className="text-xs text-muted-foreground mt-1">Live on the marketplace</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sold</CardTitle>
            <Tags className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.sold}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed sales</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flagged</CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.needsModeration}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting moderation</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Listings by Status</CardTitle>
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
                      {item.image_url || item.vault_item?.card_image ? (
                        <img src={toCdnUrl(item.image_url || item.vault_item?.card_image)} alt={item.vault_item?.card_name || 'Listing'} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.vault_item?.card_name || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.status || 'unknown'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatAud(item.price_aud)}</p>
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