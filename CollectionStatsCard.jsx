import React from 'react';
import { Layers, DollarSign, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const CollectionStatsCard = ({ stats, loading }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="stat-card animate-pulse bg-card border-[hsl(var(--card-border))]">
            <CardContent className="p-6 flex flex-col justify-center h-full">
              <div className="h-10 w-10 bg-secondary rounded-full mb-4" />
              <div className="h-8 bg-secondary rounded w-1/2 mb-2" />
              <div className="h-4 bg-secondary rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
      {/* Total Cards */}
      <Card className="stat-card group bg-card border-[hsl(var(--card-border))]">
        <CardContent className="p-6 flex flex-col justify-center h-full relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative z-10">
            <Layers className="w-5 h-5" />
          </div>
          <div className="stat-value relative z-10 text-foreground font-bold text-2xl">{stats.totalCards}</div>
          <div className="stat-label relative z-10 text-muted-foreground text-sm">Total Cards</div>
        </CardContent>
      </Card>

      {/* Collection Value */}
      <Card className="stat-card group bg-card border-[hsl(var(--card-border))]">
        <CardContent className="p-6 flex flex-col justify-center h-full relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mb-4 relative z-10">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="stat-value relative z-10 text-foreground font-bold text-2xl">{formatCurrency(stats.collectionValue)}</div>
          <div className="stat-label relative z-10 text-muted-foreground text-sm">Collection Value</div>
        </CardContent>
      </Card>

      {/* Available for Trade */}
      <Card className="stat-card group bg-card border-[hsl(var(--card-border))]">
        <CardContent className="p-6 flex flex-col justify-center h-full relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 mb-4 relative z-10">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="stat-value relative z-10 text-foreground font-bold text-2xl">{stats.cardsForTrade}</div>
          <div className="stat-label relative z-10 text-muted-foreground text-sm">Available for Trade</div>
        </CardContent>
      </Card>

      {/* Collection Growth */}
      <Card className="stat-card group bg-card border-[hsl(var(--card-border))]">
        <CardContent className="p-6 flex flex-col justify-center h-full relative overflow-hidden">
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out ${stats.isGrowing ? 'bg-green-500/5' : 'bg-destructive/5'}`} />
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 relative z-10 ${stats.isGrowing ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
            {stats.isGrowing ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <div className={`stat-value relative z-10 font-bold text-2xl ${stats.isGrowing ? 'text-green-600' : 'text-destructive'}`}>
            {formatPercentage(stats.growthPercentage)}
          </div>
          <div className="stat-label relative z-10 text-muted-foreground text-sm">Collection Growth</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CollectionStatsCard;