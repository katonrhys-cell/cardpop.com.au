import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Settings2, Loader2, Percent, Truck, Building2 } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

const SupplySettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiServerClient.fetch('/supplies/admin/settings')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load settings')))
      .then(data => { if (!cancelled) setSettings(data); })
      .catch(e => toast.error(e.message));
    return () => { cancelled = true; };
  }, []);

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiServerClient.fetch('/supplies/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSettings(data);
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Supply Settings | Admin</title></Helmet>

      <AdminPageHeader
        icon={Settings2}
        title="Supply Settings"
        subtitle="Pricing rules, shipping thresholds and tax invoice details for the supplies range."
      />

      {!settings ? (
        <div className="grid md:grid-cols-2 gap-6">
          {[0, 1].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl"><Percent className="w-5 h-5" /></div>
                <div>
                  <h2 className="font-bold text-foreground">Pricing</h2>
                  <p className="text-xs text-muted-foreground">Applied when suggesting retail prices from supplier cost</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Markup %</Label>
                <Input
                  type="number" min="0" step="1"
                  value={settings.supplies_default_markup_pct}
                  onChange={e => set('supplies_default_markup_pct', e.target.value)}
                  className="bg-background tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Suggested retail = cost + markup, rounded up to 5c. Products can override this individually.
                </p>
              </div>
            </Card>

            <Card className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl"><Truck className="w-5 h-5" /></div>
                <div>
                  <h2 className="font-bold text-foreground">Shipping</h2>
                  <p className="text-xs text-muted-foreground">Applies to platform-shipped shop goods at checkout</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Free Shipping Over ($)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={settings.free_shipping_threshold_aud}
                    onChange={e => set('free_shipping_threshold_aud', e.target.value)}
                    className="bg-background tabular-nums"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flat Fee Under ($)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={settings.flat_shipping_fee_aud}
                    onChange={e => set('flat_shipping_fee_aud', e.target.value)}
                    className="bg-background tabular-nums"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Orders under the threshold are charged the flat fee so the shipping cost is always covered.
              </p>
            </Card>
          </div>

          <Card className="p-6 rounded-2xl border border-border bg-card space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl"><Building2 className="w-5 h-5" /></div>
              <div>
                <h2 className="font-bold text-foreground">Tax Invoice Details</h2>
                <p className="text-xs text-muted-foreground">Shown on GST tax invoices emailed to customers</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={settings.business_name}
                  onChange={e => set('business_name', e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>ABN</Label>
                <Input
                  value={settings.business_abn}
                  onChange={e => set('business_abn', e.target.value)}
                  placeholder="12 345 678 901"
                  className="bg-background tabular-nums"
                />
                <p className="text-xs text-muted-foreground">Required on tax invoices for GST-registered businesses.</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="font-bold rounded-xl px-8">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SupplySettingsPage;
