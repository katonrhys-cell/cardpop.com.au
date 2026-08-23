import React, { useState, useEffect } from 'react';
import { Bell, Save, Smartphone } from 'lucide-react';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getPushStatus, enablePush, disablePush } from '@/lib/pushNotifications.js';
import { toast } from 'sonner';

// Per-device web push opt-in. Renders only when the browser/build can do push
// at all ('unsupported' and 'unconfigured' hide the card entirely) — an
// unavailable toggle is worse than no toggle.
const PushCard = () => {
  const [status, setStatus] = useState(null); // null = probing
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushStatus().then(s => { if (!cancelled) setStatus(s); });
    return () => { cancelled = true; };
  }, []);

  if (!status || status === 'unsupported' || status === 'unconfigured') return null;

  const onToggle = async () => {
    setBusy(true);
    try {
      if (status === 'enabled') {
        await disablePush();
        setStatus('available');
        toast.success('Push notifications turned off on this device');
      } else {
        await enablePush();
        setStatus('enabled');
        toast.success('Push notifications enabled on this device');
      }
    } catch (err) {
      toast.error(err.message || 'Could not update push notifications');
      setStatus(await getPushStatus());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-bold text-sm">Push notifications on this device</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status === 'denied'
              ? 'Notifications are blocked in your browser settings — allow them for this site to enable push.'
              : 'Get offers, sales, trades and order updates even when CardPop is closed.'}
          </p>
        </div>
      </div>
      <Switch
        checked={status === 'enabled'}
        disabled={busy || status === 'denied'}
        onCheckedChange={onToggle}
      />
    </div>
  );
};

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
    <AccountPageShell
      documentTitle="Notification Settings | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Notifications', path: '/account/notifications' }, { label: 'Settings' }]}
      title="Notification Settings"
      description="Control which notifications you receive."
      actions={
        <Button size="sm" onClick={save} disabled={saving || loading} className="rounded-xl shadow-sm h-10 px-4 font-bold gap-2">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      }
    >
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          <PushCard />
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
    </AccountPageShell>
  );
};

export default AccountNotificationSettings;
