import React from 'react';
import { Helmet } from 'react-helmet';
import { Bookmark } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountWatchlist = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Watchlist | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Watchlist' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Watchlist</h1>
        <p className="text-muted-foreground">Items you're keeping an eye on.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">Your watchlist is empty</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Save items you're interested in to easily find them later.
        </p>
      </div>
    </div>
  );
};

export default AccountWatchlist;