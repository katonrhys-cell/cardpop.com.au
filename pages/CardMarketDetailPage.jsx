import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, TrendingUp, AlertCircle, ShoppingCart, Calendar } from 'lucide-react';
import { PriceTrendChart } from '@/components/PriceTrendChart.jsx';
import { GradingBreakdownChart } from '@/components/GradingBreakdownChart.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import apiServerClient from '@/lib/apiServerClient.js';

const CardMarketDetailPage = () => {
  const { cardId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCardDetails = async () => {
      try {
        const response = await apiServerClient.fetch(`/ebay/card-details/${cardId}`);
        if (!response.ok) throw new Error('Failed to fetch card details');
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCardDetails();
  }, [cardId]);

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <Helmet>
        <title>{data?.card ? `${data.card.name} Market Data` : 'Card Market Details'} - Card Pop</title>
      </Helmet>

      <div className="flex flex-col bg-background font-sans">
        
        <div className="flex-1 py-12 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl space-y-8">
            
            <Link to="/australian-markets" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors group">
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
              Back to Australian Markets
            </Link>

            {error && (
              <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20 font-bold flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-8">
                <Skeleton className="w-2/3 h-16 rounded-2xl" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Skeleton className="lg:col-span-2 h-[450px] rounded-3xl" />
                  <Skeleton className="h-[450px] rounded-3xl" />
                </div>
              </div>
            ) : data ? (
              <>
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                  <div>
                    <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 shadow-sm">
                      {data.card.collection}
                    </Badge>
                    <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight mb-2">
                      {data.card.name}
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg">
                      Market Analysis & Recent Sales Data
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Market Trend</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-primary" />
                      <span className="text-2xl font-bold capitalize text-foreground">{data.insights.trend}</span>
                    </div>
                    <span className="text-sm text-muted-foreground font-medium mt-1">Based on {data.insights.comparableSales} comparable sales</span>
                  </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Price History Chart */}
                  <div className="lg:col-span-2 bg-card rounded-3xl border border-border shadow-sm p-6 md:p-8">
                    <h2 className="font-serif text-2xl font-bold mb-2">30-Day Price History</h2>
                    <p className="text-sm text-muted-foreground font-medium mb-8">Average completed sales price over time</p>
                    <PriceTrendChart data={data.priceHistory} />
                  </div>

                  {/* Grading Breakdown */}
                  <div className="bg-card rounded-3xl border border-border shadow-sm p-6 md:p-8">
                    <h2 className="font-serif text-2xl font-bold mb-2">Condition Breakdown</h2>
                    <p className="text-sm text-muted-foreground font-medium mb-8">Volume of sales by card grade</p>
                    <GradingBreakdownChart data={data.gradingBreakdown} />
                  </div>

                </div>

                {/* Sales Data Table */}
                <div className="mt-12 bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                  <div className="p-6 md:p-8 border-b border-border bg-muted/20">
                    <h2 className="font-serif text-2xl font-bold mb-1">Recent Transactions</h2>
                    <p className="text-sm text-muted-foreground font-medium">Verified completed sales from eBay Australia</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold tracking-wider">
                        <tr>
                          <th className="px-8 py-4">Date</th>
                          <th className="px-8 py-4">Condition</th>
                          <th className="px-8 py-4 text-right">Quantity</th>
                          <th className="px-8 py-4 text-right">Sold Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.salesData && data.salesData.length > 0 ? (
                          data.salesData.map((sale, idx) => (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                                  <Calendar className="w-4 h-4" />
                                  {format(new Date(sale.saleDate), 'MMM d, yyyy')}
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <Badge variant="secondary" className="font-bold bg-secondary/10 text-secondary-foreground shadow-sm">
                                  {sale.condition}
                                </Badge>
                              </td>
                              <td className="px-8 py-4 text-right font-bold text-muted-foreground tabular-nums">
                                {sale.quantity}
                              </td>
                              <td className="px-8 py-4 text-right font-bold text-foreground text-base tabular-nums">
                                {formatCurrency(sale.soldPrice)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-8 py-12 text-center text-muted-foreground font-medium">
                              No recent transactions found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}

          </div>
        </div>
      </div>
    </>
  );
};

export default CardMarketDetailPage;