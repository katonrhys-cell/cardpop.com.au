import React from 'react';
import { Helmet } from 'react-helmet';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountSecurity = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Security Settings | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Security' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Security Settings</h1>
        <p className="text-muted-foreground">Manage your password and account security.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Change Password</Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Enable 2FA</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSecurity;