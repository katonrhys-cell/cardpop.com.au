import React from 'react';
import { Helmet } from 'react-helmet';
import { Bell } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountNotifications = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Notifications | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Notifications' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Notifications</h1>
        <p className="text-muted-foreground">Stay updated on your account activity.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">All caught up</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          You don't have any new notifications right now.
        </p>
      </div>
    </div>
  );
};

export default AccountNotifications;