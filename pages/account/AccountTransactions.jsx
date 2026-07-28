import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';

const AccountTransactions = () => {
  return (
    <AccountPageShell
      documentTitle="Transactions | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Transactions' }]}
      title="Transactions"
      description="View your purchase and sale history."
    >
      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">No transactions yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your transaction history will appear here once you buy or sell items.
        </p>
      </div>
    </AccountPageShell>
  );
};

export default AccountTransactions;