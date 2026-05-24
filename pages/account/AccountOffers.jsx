import React from 'react';
import { Helmet } from 'react-helmet';
import { Tag } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountOffers = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Offers | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Offers' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Offers</h1>
        <p className="text-muted-foreground">Manage offers you've sent and received.</p>
      </div>

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="received">Received Offers</TabsTrigger>
          <TabsTrigger value="sent">Sent Offers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="received" className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No received offers</h3>
          <p className="text-muted-foreground">You haven't received any offers yet.</p>
        </TabsContent>
        
        <TabsContent value="sent" className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No sent offers</h3>
          <p className="text-muted-foreground">You haven't sent any offers yet.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountOffers;