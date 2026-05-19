
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ChevronLeft, Save, Settings, Shield, Mail, CreditCard, MessageSquare, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Mock state for settings
  const [settings, setSettings] = useState({
    siteName: 'CardPop',
    contactEmail: 'support@cardpop.com',
    commissionRate: '5',
    requireMfa: false,
    enableMarketplace: true,
    enableTrading: true,
    bannedWords: 'spam, scam, fake',
  });

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Settings saved successfully.');
    } catch (error) {
      toast.error('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
      <Helmet><title>Platform Settings | Admin</title></Helmet>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="h-10 rounded-xl px-3 mt-0.5 shrink-0">
            <ChevronLeft className="w-5 h-5 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Platform Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure global application parameters.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="gap-2 font-bold rounded-xl h-10 px-6">
          <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 mb-6 bg-muted/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="general" className="rounded-lg py-2.5"><Settings className="w-4 h-4 mr-2 hidden sm:block"/> General</TabsTrigger>
          <TabsTrigger value="payment" className="rounded-lg py-2.5"><CreditCard className="w-4 h-4 mr-2 hidden sm:block"/> Payment</TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg py-2.5"><Mail className="w-4 h-4 mr-2 hidden sm:block"/> Email</TabsTrigger>
          <TabsTrigger value="moderation" className="rounded-lg py-2.5"><MessageSquare className="w-4 h-4 mr-2 hidden sm:block"/> Moderation</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg py-2.5"><Shield className="w-4 h-4 mr-2 hidden sm:block"/> Security</TabsTrigger>
          <TabsTrigger value="features" className="rounded-lg py-2.5"><LayoutGrid className="w-4 h-4 mr-2 hidden sm:block"/> Features</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic information about the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input value={settings.siteName} onChange={e => handleChange('siteName', e.target.value)} className="max-w-md bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" value={settings.contactEmail} onChange={e => handleChange('contactEmail', e.target.value)} className="max-w-md bg-background" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Payment & Fees</CardTitle>
              <CardDescription>Configure marketplace commission and payment gateways.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Platform Commission Rate (%)</Label>
                <Input type="number" value={settings.commissionRate} onChange={e => handleChange('commissionRate', e.target.value)} className="max-w-xs bg-background" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Security Policies</CardTitle>
              <CardDescription>Manage authentication and access rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between max-w-md">
                <div className="space-y-0.5">
                  <Label>Require MFA for Admins</Label>
                  <p className="text-sm text-muted-foreground">Force two-factor authentication for all admin accounts.</p>
                </div>
                <Switch checked={settings.requireMfa} onCheckedChange={v => handleChange('requireMfa', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Enable or disable core platform features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between max-w-md">
                <div className="space-y-0.5">
                  <Label>Enable Marketplace</Label>
                  <p className="text-sm text-muted-foreground">Allow users to buy and sell items.</p>
                </div>
                <Switch checked={settings.enableMarketplace} onCheckedChange={v => handleChange('enableMarketplace', v)} />
              </div>
              <div className="flex items-center justify-between max-w-md">
                <div className="space-y-0.5">
                  <Label>Enable Trading</Label>
                  <p className="text-sm text-muted-foreground">Allow users to propose card trades.</p>
                </div>
                <Switch checked={settings.enableTrading} onCheckedChange={v => handleChange('enableTrading', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Content Moderation</CardTitle>
              <CardDescription>Rules for user-generated content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Banned Words (comma separated)</Label>
                <Textarea value={settings.bannedWords} onChange={e => handleChange('bannedWords', e.target.value)} className="bg-background min-h-[100px]" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>Manage system email templates and routing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Email templates are managed via PocketBase hooks.</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AdminSettingsPage;
