import React from 'react';
import { Helmet } from 'react-helmet';
import { Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountWallet = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Wallet | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Wallet' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Wallet</h1>
        <p className="text-muted-foreground">Manage your balance and payment methods.</p>
      </div>

      <Card className="shadow-sm bg-primary text-primary-foreground border-none">
        <CardHeader>
          <CardTitle className="text-primary-foreground/80">Available Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold mb-6">$0.00</div>
          <div className="flex gap-3">
            <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">Withdraw</Button>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">Add Funds</Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm mt-6">
        <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">No payment methods</h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Add a payment method to make purchases on the marketplace.
        </p>
        <Button variant="outline">Add Payment Method</Button>
      </div>
    </div>
  );
};

export default AccountWallet;