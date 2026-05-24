import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowRightLeft } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountTransactions = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Transactions | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Transactions' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Transactions</h1>
        <p className="text-muted-foreground">View your purchase and sale history.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">No transactions yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your transaction history will appear here once you buy or sell items.
        </p>
      </div>
    </div>
  );
};

export default AccountTransactions;