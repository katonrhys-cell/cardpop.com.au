
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PriceHistoryChart = ({ data, loading }) => {
  if (loading) {
    return (
      <Card className="shadow-sm border-border mb-8">
        <CardHeader>
          <CardTitle className="font-serif">Price Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[300px] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm border-border mb-8">
        <CardHeader>
          <CardTitle className="font-serif">Price Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          No trend data available for this period.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-border mb-8">
      <CardHeader>
        <CardTitle className="font-serif">Price Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value) => [`$${value}`, 'Price']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                name="Average Price" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3} 
                dot={{ r: 4, fill: 'hsl(var(--primary))' }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PriceHistoryChart;
