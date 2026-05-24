import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const MarketStatsCard = ({ title, value, icon: Icon, trend, trendLabel }) => {
  const isPositive = trend > 0;
  const isNegative = trend < 0;
  const isNeutral = !trend || trend === 0;

  return (
    <div className="premium-card p-6 flex flex-col h-full relative overflow-hidden group bg-card border-border">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
        {Icon && (
          <div className="p-2 bg-secondary rounded-lg">
            <Icon className="w-5 h-5 text-secondary-foreground" />
          </div>
        )}
      </div>
      
      <div className="mt-auto relative z-10">
        <h3 className="text-3xl font-bold tabular-nums tracking-tight mb-2 text-foreground">{value}</h3>
        
        {trend !== undefined && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
              isPositive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 
              isNegative ? 'bg-destructive/10 text-destructive' : 
              'bg-secondary text-muted-foreground'
            }`}>
              {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
              {isNeutral && <Minus className="w-3.5 h-3.5" />}
              {Math.abs(trend)}%
            </span>
            {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};