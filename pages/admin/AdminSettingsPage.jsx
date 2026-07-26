import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, Save, Settings, Shield, Mail, MessageSquare, LayoutGrid, RefreshCcw, AlertCircle } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

const DEFAULT_SETTINGS = {
  site_name: 'CardPop',
  contact_email: 'support@cardpop.com.au',
  notification_email: 'notifications@cardpop.com.au',
  maintenance_mode: false,
  listing_approval_required: false,
  max_images_per_listing: '10',
  free_shipping_threshold_aud: '50',
  default_shipping_rate_aud: '10',
  require_mfa_admins: false,
  email_verification_required: true,
  enable_marketplace: true,
  // Off until the propose-trade flow ships (mirrors src/routes/settings.js)
  enable_trading: false,
  enable_blog: true,
  banned_words: '',
};

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase.from('platform_settings').select('key, value').then(({ data, error: fetchErr }) => {
      if (cancelled) return;
      if (fetchErr) { setError(fetchErr.message || 'Failed to load settings.'); setLoading(false); return; }
      const merged = { ...DEFAULT_SETTINGS };
      (data ?? []).forEach(({ key, value }) => { merged[key] = value; });
      setSettings(merged);
      setLoading(false);
    }).catch(err => {
      if (!cancelled) { setError(err.message || 'Failed to load settings.'); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, [reload]);

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = Object.entries(settings).map(([key, value]) => ({ key, value }));
      const { error } = await supabase
        .from('platform_settings')
        .upsert(upserts, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Settings saved successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <p className="text-foreground font-medium mb-4">{error}</p>
        <Button variant="outline" onClick={() => setReload(r => r + 1)} className="gap-2">
          <RefreshCcw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-5 sm:px-8 md:px-12 xl:px-16 max-w-[90rem] mx-auto">
      <Helmet><title>Platform Settings | Admin</title></Helmet>

      <AdminPageHeader
        icon={Settings}
        title="Platform Settings"
        subtitle="Configure global application parameters."
      >
        <Button onClick={handleSave} disabled={saving} variant="outline" className="gap-2 font-bold rounded-xl h-10 px-6 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </AdminPageHeader>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 mb-6 bg-muted/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="general" className="rounded-lg py-2.5"><Settings className="w-4 h-4 mr-1.5 hidden sm:block" />General</TabsTrigger>
          <TabsTrigger value="listings" className="rounded-lg py-2.5"><LayoutGrid className="w-4 h-4 mr-1.5 hidden sm:block" />Listings</TabsTrigger>
          <TabsTrigger value="moderation" className="rounded-lg py-2.5"><MessageSquare className="w-4 h-4 mr-1.5 hidden sm:block" />Moderation</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg py-2.5"><Shield className="w-4 h-4 mr-1.5 hidden sm:block" />Security</TabsTrigger>
          <TabsTrigger value="features" className="rounded-lg py-2.5"><Mail className="w-4 h-4 mr-1.5 hidden sm:block" />Features</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic platform identity and contact information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input value={settings.site_name} onChange={e => set('site_name', e.target.value)} className="max-w-md bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" value={settings.contact_email} onChange={e => set('contact_email', e.target.value)} className="max-w-md bg-background" />
                <p className="text-xs text-muted-foreground">Public support address shown to customers.</p>
              </div>
              <div className="space-y-2">
                <Label>Notification Email</Label>
                <Input type="email" value={settings.notification_email} onChange={e => set('notification_email', e.target.value)} className="max-w-md bg-background" placeholder="notifications@cardpop.com.au" />
                <p className="text-xs text-muted-foreground">Internal inbox for admin alerts — new orders and user event submissions. Falls back to the contact email if left blank.</p>
              </div>
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">Show a maintenance banner to all visitors.</p>
                </div>
                <Switch checked={!!settings.maintenance_mode} onCheckedChange={v => set('maintenance_mode', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Listings */}
        <TabsContent value="listings">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Listing Settings</CardTitle>
              <CardDescription>Rules governing how items are listed on the marketplace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Require Listing Approval</Label>
                  <p className="text-sm text-muted-foreground">New listings go into a pending queue until reviewed by an admin.</p>
                </div>
                <Switch checked={!!settings.listing_approval_required} onCheckedChange={v => set('listing_approval_required', v)} />
              </div>
              <div className="space-y-2">
                <Label>Max Images per Listing</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.max_images_per_listing}
                  onChange={e => set('max_images_per_listing', e.target.value)}
                  className="max-w-xs bg-background"
                />
              </div>
              <div className="space-y-2 max-w-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Free Shipping Threshold (AUD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.free_shipping_threshold_aud}
                      onChange={e => set('free_shipping_threshold_aud', e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Shipping Rate (AUD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.default_shipping_rate_aud}
                      onChange={e => set('default_shipping_rate_aud', e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Applied to CardPop Shop items at checkout — a flat rate charged once per order, waived when the shop-item subtotal reaches the threshold. A rate of 0 disables shipping charges; a threshold of 0 means no free-shipping tier. Marketplace listings ship seller-arranged and are unaffected.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Moderation */}
        <TabsContent value="moderation">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Content Moderation</CardTitle>
              <CardDescription>Rules for filtering user-generated content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Banned Words</Label>
                <Textarea
                  value={settings.banned_words}
                  onChange={e => set('banned_words', e.target.value)}
                  placeholder="spam, scam, fake (comma-separated)"
                  className="bg-background min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">Comma-separated list. Listings and reviews containing these words will be flagged for review.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Security Policies</CardTitle>
              <CardDescription>Authentication and access control settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Require MFA for Admins</Label>
                  <p className="text-sm text-muted-foreground">Force two-factor authentication for all admin accounts.</p>
                </div>
                <Switch checked={!!settings.require_mfa_admins} onCheckedChange={v => set('require_mfa_admins', v)} />
              </div>
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Email Verification Required</Label>
                  <p className="text-sm text-muted-foreground">Users must verify their email before they can buy or sell.</p>
                </div>
                <Switch checked={!!settings.email_verification_required} onCheckedChange={v => set('email_verification_required', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features">
          <Card className="border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Enable or disable core platform features globally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Marketplace</Label>
                  <p className="text-sm text-muted-foreground">Allow users to buy and sell items.</p>
                </div>
                <Switch checked={!!settings.enable_marketplace} onCheckedChange={v => set('enable_marketplace', v)} />
              </div>
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Trading</Label>
                  <p className="text-sm text-muted-foreground">Allow users to propose card trades.</p>
                </div>
                <Switch checked={!!settings.enable_trading} onCheckedChange={v => set('enable_trading', v)} />
              </div>
              <div className="flex items-center justify-between max-w-md rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Blog</Label>
                  <p className="text-sm text-muted-foreground">Show the blog section and published articles.</p>
                </div>
                <Switch checked={!!settings.enable_blog} onCheckedChange={v => set('enable_blog', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettingsPage;
