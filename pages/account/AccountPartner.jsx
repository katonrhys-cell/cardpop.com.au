import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  BadgeCheck, Banknote, Clock, Copy, Handshake, Link2, Loader2,
  MousePointerClick, ShoppingBag, Store, XCircle,
} from 'lucide-react';

const aud = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const StatTile = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" /> {label}
    </div>
    <div className="mt-1.5 text-2xl font-bold">{value}</div>
  </div>
);

const KIND_LABEL = { shop_order: 'Shop order', subscription: 'Seller membership' };
const STATUS_BADGE = {
  pending: { variant: 'secondary', label: 'Pending' },
  paid: { variant: 'default', label: 'Paid' },
  reversed: { variant: 'destructive', label: 'Reversed' },
};

const AccountPartner = () => {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectStatus, setConnectStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch('/partners/me');
      if (res.ok) setData(await res.json());
    } catch {
      toast.error('Could not load your partner details.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConnect = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch('/stripe/connect/status');
      if (res.ok) setConnectStatus(await res.json());
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const partner = data?.partner;
  const approved = partner?.status === 'approved';

  useEffect(() => {
    if (approved) loadConnect();
  }, [approved, loadConnect]);

  // Returning from Stripe onboarding — re-check status.
  useEffect(() => {
    if (params.get('connect') === 'success') loadConnect();
  }, [params, loadConnect]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/account/partner?connect=success`;
      const refreshUrl = `${window.location.origin}/account/partner?connect=refresh`;
      const res = await apiServerClient.fetch('/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl, refreshUrl }),
      });
      if (!res.ok) throw new Error('Failed to start Stripe onboarding');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || 'Could not start Stripe onboarding.');
      setConnecting(false);
    }
  };

  const copy = (text, what) => {
    navigator.clipboard?.writeText(text)
      .then(() => toast.success(`${what} copied.`))
      .catch(() => toast.error('Could not copy — long-press to copy manually.'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not applied yet → point at the program.
  if (!partner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Helmet><title>Partner Dashboard | CardPop</title></Helmet>
        <div className="bg-card border border-border rounded-3xl p-10 text-center max-w-lg">
          <Handshake className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">Become a CardPop partner</h1>
          <p className="text-muted-foreground mb-6">
            Local game stores, creators and community builders earn commission on referred
            sales with their own discount code and referral link.
          </p>
          <Button asChild><Link to="/partners">Learn more & apply</Link></Button>
        </div>
      </div>
    );
  }

  if (partner.status === 'pending' || partner.status === 'rejected') {
    const pending = partner.status === 'pending';
    const Icon = pending ? Clock : XCircle;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Helmet><title>Partner Dashboard | CardPop</title></Helmet>
        <div className="bg-card border border-border rounded-3xl p-10 text-center max-w-lg">
          <Icon className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">
            {pending ? 'Application under review' : 'Application not approved'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {pending
              ? `Thanks ${partner.business_name} — we review every application personally. Your code and rates will appear here once you're approved.`
              : 'Your application wasn’t approved this time. If your store or audience has grown since, get in touch and we’ll take another look.'}
          </p>
          <Link to="/partners" className="text-primary font-semibold hover:underline">
            About the partner program →
          </Link>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/?ref=${partner.code}`;
  const stats = data.stats || {};
  const referrals = data.referrals || [];
  const onboarded = connectStatus?.onboarded;

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Partner Dashboard | CardPop</title></Helmet>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 space-y-8">

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Handshake className="w-7 h-7 text-primary" /> Partner Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              {partner.business_name} · <BadgeCheck className="inline w-4 h-4 text-green-600 -mt-0.5" /> Approved partner
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {Number(partner.discount_pct)}% customer discount · {Number(partner.commission_pct)}% commission
          </Badge>
        </header>

        {/* Code + link */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Your code & referral link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-xl border border-border bg-muted/40 px-4 py-2 font-mono text-lg tracking-widest">
                {partner.code}
              </code>
              <Button variant="outline" size="sm" onClick={() => copy(partner.code, 'Code')}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy code
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy(referralLink, 'Referral link')}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground break-all">{referralLink}</p>
            <p className="text-sm text-muted-foreground">
              Customers using your code get {Number(partner.discount_pct)}% off CardPop Shop orders
              {partner.free_shipping ? ' plus free shipping' : ''}, and you earn{' '}
              {Number(partner.commission_pct)}% of each referred sale.
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile icon={MousePointerClick} label="Link clicks" value={stats.clicks ?? 0} />
          <StatTile icon={ShoppingBag} label="Referred orders" value={stats.referredOrders ?? 0} />
          <StatTile icon={Clock} label="Pending earnings" value={aud(stats.pendingCents)} />
          <StatTile icon={Banknote} label="Paid out" value={aud(stats.paidCents)} />
        </div>

        {/* Payout onboarding */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Payouts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {onboarded ? (
              <p className="text-sm text-muted-foreground">
                <BadgeCheck className="inline w-4 h-4 text-green-600 -mt-0.5" /> Your bank account is
                connected via Stripe. Pending commission is transferred to you in payout sweeps.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your bank account through Stripe (one-time, a few minutes) so we can
                  transfer your commission. Earnings keep accruing either way.
                </p>
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Store className="w-4 h-4 mr-2" />}
                  Set up payouts with Stripe
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ledger */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Referred purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No referred purchases yet — share your link and code to get started.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {referrals.map((r) => {
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <div className="font-medium">{KIND_LABEL[r.kind] || r.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}sale {aud(r.sale_amount_cents)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{aud(r.commission_cents)}</span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AccountPartner;
