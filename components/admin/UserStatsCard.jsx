import React from 'react';
import { Package, ShoppingCart, Store, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const StatItem = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/40">
    <Icon className="h-5 w-5 text-muted-foreground" />
    <span className="text-2xl font-bold">{value ?? 0}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

const UserStatsCard = ({ user, vaultProductsCount, ordersBuyerCount, ordersSellerCount, reviewsCount }) => {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatItem icon={Package} label="Vault Items" value={vaultProductsCount} />
          <StatItem icon={ShoppingCart} label="Purchases" value={ordersBuyerCount} />
          <StatItem icon={Store} label="Sales" value={ordersSellerCount} />
          <StatItem icon={Star} label="Reviews" value={reviewsCount} />
        </div>
      </CardContent>
    </Card>
  );
};

export default UserStatsCard;
