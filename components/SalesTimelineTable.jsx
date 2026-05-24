
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const SalesTimelineTable = ({ transactions, loading, onCardClick }) => {
  if (loading) {
    return (
      <Card className="shadow-sm border-border">
        <CardHeader>
          <CardTitle className="font-serif">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-border overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border">
        <CardTitle className="font-serif">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No recent transactions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">Date</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">Card Name</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">Price</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">Type</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-muted-foreground">
                      {new Date(tx.created).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {tx.expand?.cardIds?.[0]?.cardName || 'Unknown Card'}
                    </td>
                    <td className="p-4 tabular-nums font-bold text-foreground">
                      ${(tx.transactionValue || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="bg-background">
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onCardClick(tx.expand?.cardIds?.[0]?.cardName)}
                        disabled={!tx.expand?.cardIds?.[0]?.cardName}
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Research
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesTimelineTable;
