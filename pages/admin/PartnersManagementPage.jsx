import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  BadgeCheck, Banknote, Check, ExternalLink, Handshake, Loader2,
  MousePointerClick, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const TYPE_LABEL = {
  local_game_store: 'Local game store',
  content_creator: 'Content creator',
  other: 'Community / other',
};

const aud = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

// Same shape the backend enforces; validate up front so approval never
// bounces on the DB unique index with a cryptic error.
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9-]{3,19}$/;

const PartnerRow = ({ partner, profile, earnings, onApproveClick, onReject, onPayout, payingOut }) => {
  const pendingCents = earnings?.pendingCents || 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{partner.business_name}</h3>
            <Badge variant={partner.status === 'approved' ? 'default' : partner.status === 'pending' ? 'secondary' : 'destructive'}>
              {partner.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{TYPE_LABEL[partner.partner_type] || partner.partner_type}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {[profile?.display_name, profile?.email, partner.phone].filter(Boolean).join(' · ')}
          </p>
          {partner.pitch && <p className="text-sm mt-2 whitespace-pre-wrap">{partner.pitch}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
            {partner.website && (
              <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                {partner.website} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {partner.abn && <span className="text-muted-foreground">ABN {partner.abn}</span>}
            {partner.preferred_code && partner.status === 'pending' && (
              <span className="text-muted-foreground">Wants code: <code className="font-mono">{partner.preferred_code}</code></span>
            )}
          </div>
          {partner.socials && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">{partner.socials}</p>
          )}
          {partner.status === 'approved' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm">
              <code className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono tracking-widest">{partner.code}</code>
              <span>{Number(partner.discount_pct)}% off · {Number(partner.commission_pct)}% commission{partner.free_shipping ? ' · free shipping' : ''}</span>
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5" /> {partner.clicks} clicks
              </span>
              <span className="text-muted-foreground">
                Pending {aud(pendingCents)} · Paid {aud(earnings?.paidCents)}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {partner.status !== 'approved' && (
            <Button size="sm" onClick={() => onApproveClick(partner)}>
              <Check className="w-4 h-4 mr-1" /> Approve…
            </Button>
          )}
          {partner.status === 'approved' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onApproveClick(partner)}>
                Edit rates
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pendingCents <= 0 || payingOut === partner.id}
                onClick={() => onPayout(partner)}
              >
                {payingOut === partner.id
                  ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  : <Banknote className="w-4 h-4 mr-1" />}
                Pay {aud(pendingCents)}
              </Button>
            </>
          )}
          {partner.status !== 'rejected' && (
            <Button size="sm" variant="outline" onClick={() => onReject(partner)}>
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const PartnersManagementPage = () => {
  const [partners, setPartners] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [earnings, setEarnings] = useState({});
  const [loading, setLoading] = useState(true);
  const [payingOut, setPayingOut] = useState(null);

  // Approval dialog state — also used to edit an approved partner's rates.
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', discountPct: '10', commissionPct: '5', freeShipping: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('partners')
      .select('id, user_id, partner_type, business_name, website, socials, abn, phone, pitch, preferred_code, code, discount_pct, commission_pct, free_shipping, status, clicks, approved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      toast.error(`Failed to load partners: ${error.message}`);
      setLoading(false);
      return;
    }
    setPartners(data || []);

    const userIds = [...new Set((data || []).map((p) => p.user_id).filter(Boolean))];
    if (userIds.length) {
      // email isn't client-readable on profiles (no column grant — selecting it
      // would 403 the whole query), so fetch names via the client and emails via
      // the admin backend, then merge.
      const [{ data: profileRows }, emailRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', userIds),
        apiServerClient.fetch('/admin/user-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: userIds }),
        }).then((r) => (r.ok ? r.json() : { emails: {} })).catch(() => ({ emails: {} })),
      ]);
      const emails = emailRes?.emails || {};
      setProfiles(Object.fromEntries((profileRows || []).map((p) => [p.id, { ...p, email: emails[p.id] || null }])));
    }

    const partnerIds = (data || []).filter((p) => p.status === 'approved').map((p) => p.id);
    if (partnerIds.length) {
      const { data: refRows } = await supabase
        .from('partner_referrals')
        .select('partner_id, commission_cents, status')
        .in('partner_id', partnerIds);
      const byPartner = {};
      for (const r of refRows || []) {
        const e = (byPartner[r.partner_id] ||= { pendingCents: 0, paidCents: 0 });
        if (r.status === 'pending') e.pendingCents += r.commission_cents;
        if (r.status === 'paid') e.paidCents += r.commission_cents;
      }
      setEarnings(byPartner);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openApprove = (partner) => {
    setEditing(partner);
    setForm({
      code: partner.code || partner.preferred_code || '',
      discountPct: String(Number(partner.discount_pct ?? 10)),
      commissionPct: String(Number(partner.commission_pct ?? 5)),
      freeShipping: !!partner.free_shipping,
    });
  };

  const saveApproval = async () => {
    const code = form.code.trim().toUpperCase();
    const discountPct = Number(form.discountPct);
    const commissionPct = Number(form.commissionPct);
    if (!CODE_SHAPE.test(code)) {
      toast.error('Code must be 4–20 characters: letters, numbers and hyphens.');
      return;
    }
    if (/^POP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      toast.error('That format is reserved for welcome codes — pick another.');
      return;
    }
    if (!(discountPct >= 0 && discountPct <= 100) || !(commissionPct >= 0 && commissionPct <= 100)) {
      toast.error('Rates must be between 0 and 100.');
      return;
    }
    setSaving(true);
    const wasApproved = editing.status === 'approved';
    const { error } = await supabase
      .from('partners')
      .update({
        status: 'approved',
        code,
        discount_pct: discountPct,
        commission_pct: commissionPct,
        free_shipping: form.freeShipping,
        approved_at: editing.approved_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.code === '23505' ? `Code "${code}" is already taken.` : `Update failed: ${error.message}`);
      return;
    }
    toast.success(wasApproved ? `${editing.business_name} updated` : `${editing.business_name} approved with code ${code}`);
    setEditing(null);
    load();
  };

  const onReject = async (partner) => {
    const { error } = await supabase
      .from('partners')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', partner.id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
      return;
    }
    toast.success(`"${partner.business_name}" rejected`);
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? { ...p, status: 'rejected' } : p)));
  };

  const onPayout = async (partner) => {
    setPayingOut(partner.id);
    try {
      const res = await apiServerClient.fetch('/partners/admin/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: partner.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Payout failed');
      toast.success(`Transferred ${aud(data.amountCents)} to ${partner.business_name}`);
      load();
    } catch (err) {
      toast.error(err.message || 'Payout failed');
    } finally {
      setPayingOut(null);
    }
  };

  const pending = partners.filter((p) => p.status === 'pending');
  const rest = partners.filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Handshake className="w-6 h-6" /> Partner Program
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review applications, set each partner's code and rates, and sweep pending
          commission to their bank via Stripe.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Loading…</p>}

      {!loading && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Pending review ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting — all clear.</p>}
            {pending.map((partner) => (
              <PartnerRow
                key={partner.id}
                partner={partner}
                profile={profiles[partner.user_id]}
                earnings={earnings[partner.id]}
                onApproveClick={openApprove}
                onReject={onReject}
                onPayout={onPayout}
                payingOut={payingOut}
              />
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">All partners ({rest.length})</h2>
            {rest.map((partner) => (
              <PartnerRow
                key={partner.id}
                partner={partner}
                profile={profiles[partner.user_id]}
                earnings={earnings[partner.id]}
                onApproveClick={openApprove}
                onReject={onReject}
                onPayout={onPayout}
                payingOut={payingOut}
              />
            ))}
          </section>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary" />
              {editing?.status === 'approved' ? 'Edit partner' : 'Approve partner'}
            </DialogTitle>
            <DialogDescription>
              {editing?.business_name} — set the code and rates. The customer discount and
              your commission both apply to referred shop orders and first membership payments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-code">Code</Label>
              <Input
                id="partner-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. TOPDECK10"
                className="font-mono uppercase tracking-widest"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner-discount">Customer discount %</Label>
                <Input
                  id="partner-discount"
                  value={form.discountPct}
                  onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-commission">Partner commission %</Label>
                <Input
                  id="partner-commission"
                  value={form.commissionPct}
                  onChange={(e) => setForm((f) => ({ ...f, commissionPct: e.target.value }))}
                  inputMode="decimal"
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm font-medium cursor-pointer">
              Free shipping on referred shop orders
              <Switch
                checked={form.freeShipping}
                onCheckedChange={(v) => setForm((f) => ({ ...f, freeShipping: v }))}
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveApproval} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing?.status === 'approved' ? 'Save changes' : 'Approve partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnersManagementPage;
