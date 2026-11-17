import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  STORE_CATEGORIES, TRUST_BADGES, STORE_NAME_MAX, STORE_TAGLINE_MAX, STORE_POLICY_MAX,
  buildStoreUpdate, storeFormFromProfile,
} from '@/utils/soleTraderStore.js';

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * Admin → Users → a sole trader → "Edit store": the words on their dealer page
 * (/dealer/<slug>). Writes `profiles` directly, as the other store controls on
 * that page do (the "Admins can update any profile" policy). The ABN, store
 * slug and logo upload stay with the owner — see utils/soleTraderStore.js.
 */
const SoleTraderStoreDialog = ({ open, onOpenChange, user, onSaved }) => {
  const [form, setForm] = useState(() => storeFormFromProfile(user));
  const [saving, setSaving] = useState(false);

  // Start from the saved values every time the dialog opens.
  useEffect(() => { if (open) setForm(storeFormFromProfile(user)); }, [open, user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const built = buildStoreUpdate(form);
    if (built.error) { toast.error(built.error); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update(built.update).eq('id', user.id);
      if (error) throw error;
      toast.success('Store updated.');
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Could not save the store.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit store</DialogTitle>
          <DialogDescription>
            The words on this member&apos;s dealer page. Their ABN, store address (URL) and logo upload stay with them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="st-name">Business name</Label>
            <Input id="st-name" value={form.business_name} onChange={set('business_name')} maxLength={STORE_NAME_MAX} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-tagline">Tagline</Label>
            <Input id="st-tagline" value={form.business_tagline} onChange={set('business_tagline')} maxLength={STORE_TAGLINE_MAX} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-policy">Shipping policy</Label>
            <Textarea id="st-policy" rows={4} value={form.dealer_shipping_policy} onChange={set('dealer_shipping_policy')} maxLength={STORE_POLICY_MAX} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Categories</legend>
            <div className="flex flex-wrap gap-2">
              {STORE_CATEGORIES.map((cat) => {
                const on = form.business_categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, business_categories: toggle(f.business_categories, cat) }))}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Trust badges</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRUST_BADGES.map((badge) => {
                const on = form.dealer_trust_badges.includes(badge.key);
                return (
                  <label key={badge.key} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setForm((f) => ({ ...f, dealer_trust_badges: toggle(f.dealer_trust_badges, badge.key) }))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold">{badge.label}</span>
                      <span className="block text-xs text-muted-foreground">{badge.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {user?.business_logo_url && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <Label htmlFor="st-remove-logo" className="text-sm">Remove the current logo</Label>
              <Switch
                id="st-remove-logo"
                checked={form.removeLogo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, removeLogo: v }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save store
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SoleTraderStoreDialog;
