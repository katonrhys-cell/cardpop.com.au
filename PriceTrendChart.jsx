import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

export const PriceTrendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[350px] flex items-center justify-center bg-muted/20 rounded-xl border border-dashed border-border">
        <p className="text-muted-foreground font-medium">Not enough data to display trends.</p>
      </div>
    );
  }

  const formatXAxis = (tickItem) => {
    try {
      return format(parseISO(tickItem), 'MMM d');
    } catch (e) {
      return tickItem;
    }
  };

  const formatYAxis = (tickItem) => {
    return `$${tickItem.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="text-sm text-muted-foreground mb-1">{formatXAxis(label)}</p>
          <p className="font-bold text-primary tabular-nums">
            ${Number(payload[0].value).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            tickFormatter={formatYAxis} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="hsl(var(--primary))" 
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};