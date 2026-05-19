import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { ListOrdered, Filter, ArrowRightLeft, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TransactionHistoryPage = () => {
  const { currentUser } = useAuth();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    const fetchTxs = async () => {
      try {
        const result = await pb.collection('transactions').getList(1, 100, {
          filter: `userIds ~ "${currentUser.id}"`,
          sort: '-created',
          expand: 'cardIds',
          $autoCancel: false
        });
        setTxs(result.items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) fetchTxs();
  }, [currentUser]);

  const filteredTxs = txs.filter(tx => typeFilter === 'All' || tx.type === typeFilter);

  const totalCommissions = txs.reduce((acc, tx) => acc + (tx.commissionAmount || 0), 0);

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet><title>Transactions | Card Pop</title></Helmet>
      
      <div className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold mb-2">Transaction History</h1>
            <p className="text-muted-foreground font-medium">Record of all your sales, purchases, and trades.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="premium-card p-6 bg-card border-l-4 border-l-primary">
            <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Transactions</p>
            <p className="text-3xl font-bold tabular-nums">{txs.length}</p>
          </div>
          <div className="premium-card p-6 bg-card border-l-4 border-l-accent">
            <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Fees Paid</p>
            <p className="text-3xl font-bold tabular-nums">${totalCommissions.toFixed(2)}</p>
          </div>
        </div>

        <div className="premium-card bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold"><ListOrdered className="w-5 h-5"/> Activity Log</div>
            <div className="w-48">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="Trade">Trades</SelectItem>
                  <SelectItem value="Sale">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold uppercase tracking-wider bg-muted/10">
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Cards Involved</th>
                  <th className="p-4 text-right">Value</th>
                  <th className="p-4 text-right">Fee</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center font-medium">Loading...</td></tr>
                ) : filteredTxs.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-muted-foreground">No transactions found.</td></tr>
                ) : (
                  filteredTxs.map(tx => (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-4 tabular-nums text-muted-foreground whitespace-nowrap">{format(new Date(tx.created), 'MMM d, yyyy')}</td>
                      <td className="p-4">
                        {tx.type === 'Trade' ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-none"><ArrowRightLeft className="w-3 h-3 mr-1"/> Trade</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-accent/20 text-accent-foreground border-none"><CreditCard className="w-3 h-3 mr-1"/> Sale</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {tx.expand?.cardIds?.length > 0 ? (
                          <span className="font-medium">{tx.expand.cardIds.map(c => c.cardName).join(', ')}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Official Store Purchase</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold tabular-nums">${tx.transactionValue.toFixed(2)}</td>
                      <td className="p-4 text-right text-muted-foreground tabular-nums">${(tx.commissionAmount || 0).toFixed(2)}</td>
                      <td className="p-4">
                        <Badge variant="outline" className={tx.status === 'Completed' ? 'border-green-500 text-green-600' : 'border-amber-500 text-amber-600'}>
                          {tx.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryPage;