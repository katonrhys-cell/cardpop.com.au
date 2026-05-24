import React from 'react';
import { Helmet } from 'react-helmet';
import { List } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountListings = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>My Listings | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Listings' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">My Listings</h1>
        <p className="text-muted-foreground">Manage your active items for sale or trade.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <List className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">No active listings</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          You don't have any items listed on the marketplace yet.
        </p>
      </div>
    </div>
  );
};

export default AccountListings;