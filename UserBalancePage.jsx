import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Wallet, ArrowDownToLine, Receipt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient';
import { Button } from '@/components/ui/button';

const UserBalancePage = () => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      if (currentUser?.id) {
        const u = await pb.collection('users').getOne(currentUser.id, { $autoCancel: false });
        setBalance(u.currentBalance || 0);
      }
    };
    fetchUser();
  }, [currentUser]);

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet><title>My Balance | Card Pop</title></Helmet>
      
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <h1 className="font-serif text-4xl font-bold mb-8 text-center">Wallet & Balance</h1>

        <div className="premium-card p-10 bg-card text-center mb-8 bg-gradient-to-br from-card to-muted/50">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2">Available Balance</p>
          <h2 className="text-6xl font-bold tabular-nums text-foreground mb-8">${balance.toFixed(2)}</h2>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="h-12 px-8 rounded-full font-bold shadow-sm">
              <ArrowDownToLine className="w-5 h-5 mr-2" /> Withdraw Funds
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 rounded-full font-bold">
              <Receipt className="w-5 h-5 mr-2" /> Add Bank Account
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="premium-card p-6 bg-card">
            <h3 className="font-bold text-lg mb-4">Withdrawal Rules</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">• <span>Minimum withdrawal amount is $50.00.</span></li>
              <li className="flex items-start gap-2">• <span>Funds usually clear within 2-3 business days.</span></li>
              <li className="flex items-start gap-2">• <span>Ensure your linked bank account matches your verified ID.</span></li>
            </ul>
          </div>
          <div className="premium-card p-6 bg-card border border-primary/20 bg-primary/5">
            <h3 className="font-bold text-lg mb-2 text-primary">Need Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">If you experience any issues with your balance or withdrawals, our support team is here.</p>
            <Button variant="outline" className="w-full bg-background">Contact Support</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserBalancePage;