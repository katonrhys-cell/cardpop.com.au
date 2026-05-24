
import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Activity, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const MarketStatsSection = ({ stats, loading }) => {
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="shadow-sm border-border hover:border-primary/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Volume</CardTitle>
          <Activity className="w-4 h-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-24" /> : (
            <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
              {formatCurrency(stats.totalVolume)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border hover:border-primary/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Average Price</CardTitle>
          <DollarSign className="w-4 h-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-20" /> : (
            <div className="text-2xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.avgPrice)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border hover:border-primary/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Highest Sale</CardTitle>
          <TrendingUp className="w-4 h-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-20" /> : (
            <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
              {formatCurrency(stats.highestSale)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border hover:border-primary/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Transactions</CardTitle>
          <Hash className="w-4 h-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-16" /> : (
            <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
              {stats.transactionCount}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketStatsSection;
