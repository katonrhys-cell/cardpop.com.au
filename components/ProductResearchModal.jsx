
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Search, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import ResearchExportButton from '@/components/ResearchExportButton.jsx';

const ProductResearchModal = ({ isOpen, onClose, cardName }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && cardName) {
      fetchInternalSalesData(cardName);
    }
  }, [isOpen, cardName]);

  const fetchInternalSalesData = async (name) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch recent completed orders from the platform
      const { data: items } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(12);

      // Filter by cardName where possible
      const relevantSales = (items || []).filter(t => {
        const title = (t.title || t.card_name || t.item_title || '').toLowerCase();
        return title.includes(name.toLowerCase());
      });

      setSales(relevantSales);
    } catch (err) {
      console.error('Market research error:', err);
      setError('Could not load market research data at this time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Market Research: {cardName}
          </DialogTitle>
          <DialogDescription>
            Recent platform sales and market analysis for this card.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex justify-end mb-4">
            <ResearchExportButton 
              data={sales} 
              filename={`${cardName}-research.csv`} 
              disabled={loading || sales.length === 0} 
            />
          </div>

          {error ? (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="font-bold">Error loading research data</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col space-y-3 p-4 border border-border rounded-xl">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : sales.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sales.map((sale) => (
                <div key={sale.id} className="p-5 bg-card border border-border rounded-xl shadow-sm">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-2xl font-extrabold text-foreground mb-2">
                    ${sale.transactionValue?.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Type: {sale.type}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground bg-muted/30 rounded-2xl border border-border border-dashed">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium text-lg text-foreground mb-2">No recent sales found</p>
              <p className="text-sm max-w-md mx-auto">We don't have enough recent transaction data on the platform for this specific card yet.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductResearchModal;
