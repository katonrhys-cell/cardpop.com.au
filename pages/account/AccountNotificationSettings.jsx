import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Bell, Save } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const CATEGORIES = [
  {
    label: 'Marketplace',
    types: [
      { key: 'listing_sold',    label: 'Your listing sold' },
      { key: 'offer_received',  label: 'Offer received on your listing' },
      { key: 'offer_accepted',  label: 'Your offer was accepted' },
      { key: 'offer_declined',  label: 'Your offer was declined' },
      { key: 'offer_countered', label: 'Counter-offer received' },
    ],
  },
  {
    label: 'Auctions & Bids',
    types: [
      { key: 'bid_placed',          label: 'Bid placed on your auction' },
      { key: 'bid_outbid',          label: 'You were outbid' },
      { key: 'auction_ending_soon', label: 'Auction ending soon' },
      { key: 'auction_ended',       label: 'Auction ended' },
      { key: 'auction_won',         label: 'You won an auction' },
    ],
  },
  {
    label: 'Watchlist',
    types: [
      { key: 'watchlist_price_drop',  label: 'Price drop on watched listing' },
      { key: 'watchlist_bid',         label: 'New bid on watched auction' },
      { key: 'watchlist_ending_soon', label: 'Watched auction ending soon' },
    ],
  },
  {
    label: 'Social',
    types: [
      { key: 'message',         label: 'New message' },
      { key: 'follow',          label: 'New follower' },
      { key: 'review_received', label: 'Review received' },
    ],
  },
  {
    label: 'Account',
    types: [
      { key: 'verification_approved', label: 'Verification approved' },
      { key: 'verification_rejected', label: 'Verification rejected' },
      { key: 'security_alert',        label: 'Security alerts' },
      { key: 'system',                label: 'System announcements' },
    ],
  },
];

const AccountNotificationSettings = () => {
  const { currentUser } = useAuth();
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('type, in_app, email')
          .eq('user_id', currentUser.id);
        if (error) throw error;
        if (!cancelled) {
          const map = {};
          (data || []).forEach(r => { map[r.type] = { in_app: r.in_app, email: r.email }; });
          setPrefs(map);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load notification preferences:', err);
          toast.error('Could not load your notification preferences.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const toggle = (type, channel) => {
    setPrefs(prev => ({
      ...prev,
      [type]: { in_app: true, email: false, ...prev[type], [channel]: !(prev[type]?.[channel] ?? true) },
    }));
  };

  const isOn = (type, channel) => prefs[type]?.[channel] ?? true;

  const save = async () => {
    if (!currentUser?.id) return;
    setSaving(true);
    try {
      const rows = Object.entries(prefs).map(([type, v]) => ({
        user_id: currentUser.id, type, in_app: v.in_app ?? true, email: v.email ?? false,
      }));
      const { error } = await supabase.from('notification_preferences').upsert(rows, { onConflict: 'user_id,type' });
      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Notification Settings | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Notifications', path: '/account/notifications' }, { label: 'Settings' }]} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-1">Notification Settings</h1>
          <p className="text-muted-foreground">Control which notifications you receive.</p>
        </div>
        <Button onClick={save} disabled={saving || loading} className="rounded-xl gap-2">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => (
            <div key={cat.label} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30">
                <h3 className="font-bold text-sm">{cat.label}</h3>
              </div>
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_80px_80px] px-5 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  <span>Notification</span>
                  <span className="text-center">In-app</span>
                  <span className="text-center">Email</span>
                </div>
                {cat.types.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-[1fr_80px_80px] px-5 py-3.5 items-center">
                    <span className="text-sm">{label}</span>
                    <div className="flex justify-center">
                      <Switch checked={isOn(key, 'in_app')} onCheckedChange={() => toggle(key, 'in_app')} />
                    </div>
                    <div className="flex justify-center">
                      <Switch checked={isOn(key, 'email')} onCheckedChange={() => toggle(key, 'email')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountNotificationSettings;
