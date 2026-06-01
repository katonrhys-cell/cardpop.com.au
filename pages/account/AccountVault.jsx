import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountVault = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>My Vault | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'My Vault' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">My Vault</h1>
          <p className="text-muted-foreground">Manage your digital card collection.</p>
        </div>
        <Button asChild>
          <Link to="/vault/add" className="gap-2">
            <Plus className="w-4 h-4" /> Add Card
          </Link>
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">Your vault is empty</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Start building your digital collection by adding your first card.
        </p>
        <Button asChild variant="outline">
          <Link to="/vault/add">Add Your First Card</Link>
        </Button>
      </div>
    </div>
  );
};

export default AccountVault;