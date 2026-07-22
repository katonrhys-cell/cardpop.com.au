import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Wallet, ExternalLink, CheckCircle2, Clock, AlertCircle,
  ArrowDownLeft, Loader2, RefreshCw, TrendingUp, Banknote,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import SavePaymentMethod from '@/components/SavePaymentMethod.jsx';
import VerifyIdentityCard from '@/components/VerifyIdentityCard.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const PAYOUT_STATUS = {
  transferred:    { label: 'Paid to Stripe',  cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300' },
  wallet_credited:{ label: 'In Wallet',        cls: 'bg-blue-500/10 text-blue-700 border-blue-300' },
  pending:        { label: 'Pending',           cls: 'bg-amber-500/10 text-amber-700 border-amber-300' },
};

const AccountWallet = () => {
  const { currentUser } = useAuth();
  const [connectStatus, setConnectStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await apiServerClient.fetch('/stripe/connect/status');
      if (res.ok) setConnectStatus(await res.json());
    } catch {
      toast.error('Could not load payment account status.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchSales = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, item_price_aud, commission_pct, platform_fee_aud, seller_proceeds_aud, payout_status, stripe_transfer_id, listing_id')
        .eq('seller_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setSales(data || []);
    } catch {
      toast.error('Could not load your sale payouts.');
    } finally {
      setLoadingSales(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchStatus();
    fetchSales();

    // If returning from Stripe onboarding, re-check status
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'success') {
      setTimeout(fetchStatus, 1500);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus, fetchSales]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/account/wallet?connect=success`;
      const refreshUrl = `${window.location.origin}/account/wallet?connect=refresh`;
      const res = await apiServerClient.fetch('/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl, refreshUrl }),
      });
      if (!res.ok) {
        // Surface the backend's reason (e.g. Stripe platform setup incomplete)
        // instead of a generic failure toast.
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || 'Failed to start Stripe onboarding');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || 'Could not start Stripe onboarding.');
      setConnecting(false);
    }
  };

  const handleDashboard = async () => {
    setOpeningDashboard(true);
    try {
      const returnUrl = `${window.location.origin}/account/wallet`;
      const res = await apiServerClient.fetch('/stripe/connect/dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl, refreshUrl: returnUrl }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || 'Could not open Stripe dashboard');
      }
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.message || 'Could not open Stripe dashboard.');
    } finally {
      setOpeningDashboard(false);
    }
  };

  const totalEarned = sales.reduce((s, o) => s + (Number(o.seller_proceeds_aud) || 0), 0);
  const walletBalance = connectStatus?.wallet_balance_aud || 0;

  return (
    <div className="max-w-[90rem] w-full mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-6 md:py-8 space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Wallet & Payouts | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Wallet & Payouts' }]} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-1">Wallet & Payouts</h1>
          <p className="text-muted-foreground">Connect Stripe to receive sale proceeds directly to your bank account.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { fetchStatus(); fetchSales(); }} className="rounded-xl shrink-0">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm bg-primary text-primary-foreground border-none">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-primary-foreground/70 uppercase tracking-wide">CardPop Wallet</CardTitle></CardHeader>
          <CardContent>
            {loadingStatus ? <Skeleton className="h-9 w-24 bg-white/20" /> : (
              <div className="text-3xl font-extrabold tabular-nums">${walletBalance.toFixed(2)}</div>
            )}
            <p className="text-xs text-primary-foreground/60 mt-1">Proceeds held until Stripe is connected</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><TrendingUp className="w-4 h-4" />Total Earned</CardTitle></CardHeader>
          <CardContent>
            {loadingSales ? <Skeleton className="h-9 w-24" /> : (
              <div className="text-3xl font-extrabold tabular-nums">${totalEarned.toFixed(2)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across {sales.length} sale{sales.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Banknote className="w-4 h-4" />Payout Method</CardTitle></CardHeader>
          <CardContent>
            {loadingStatus ? <Skeleton className="h-9 w-32" /> : connectStatus?.onboarded ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="font-bold text-emerald-600">Stripe Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-amber-600">Not Connected</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{connectStatus?.onboarded ? 'Proceeds paid automatically' : 'Connect Stripe to get paid'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Prerequisites for transacting — identity verification + a card on file.
          Both are required before buying, selling or trading (see SellingGate /
          DB can_sell()); the card is never charged until you actually transact. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VerifyIdentityCard />
        <SavePaymentMethod />
      </div>

      {/* Stripe Connect panel */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 px-6 py-5">
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Stripe Payout Account
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loadingStatus ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : connectStatus?.onboarded ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-700">Your Stripe account is active</p>
                  <p className="text-sm text-emerald-700/80 mt-0.5">Sale proceeds (minus CardPop's commission) are transferred to your bank automatically when a sale completes.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDashboard} disabled={openingDashboard} className="gap-2 rounded-xl font-bold">
                  {openingDashboard ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Open Stripe Dashboard
                </Button>
                <Button variant="outline" onClick={handleConnect} disabled={connecting} className="gap-2 rounded-xl">
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Update Stripe Details
                </Button>
              </div>
            </div>
          ) : connectStatus?.connected && !connectStatus?.onboarded ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-700">Stripe onboarding incomplete</p>
                  <p className="text-sm text-amber-700/80 mt-0.5">You started connecting Stripe but didn't finish. Complete onboarding to start receiving automatic payouts.</p>
                </div>
              </div>
              <Button onClick={handleConnect} disabled={connecting} className="gap-2 rounded-xl font-bold">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Continue Stripe Onboarding
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4 mb-2">
                {[
                  { icon: CheckCircle2, title: 'Instant payouts', desc: 'Proceeds hit your bank when a sale completes' },
                  { icon: CheckCircle2, title: 'Automatic commission split', desc: "CardPop's fee is deducted before you're paid" },
                  { icon: CheckCircle2, title: 'Stripe handles compliance', desc: 'KYC, tax documents, and bank security managed by Stripe' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                    <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div><p className="font-bold text-sm">{title}</p><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
                  </div>
                ))}
              </div>
              <Button onClick={handleConnect} disabled={connecting} size="lg" className="gap-2 rounded-xl font-bold">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
                Connect Stripe Account
              </Button>
              <p className="text-xs text-muted-foreground">You'll be redirected to Stripe's secure onboarding. CardPop never stores your bank details.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales & payout history */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 px-6 py-5">
          <CardTitle className="font-serif text-xl">Sale Payouts</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left font-semibold text-muted-foreground px-6 py-3">Date</th>
                <th className="text-right font-semibold text-muted-foreground px-4 py-3">Sale Price</th>
                <th className="text-right font-semibold text-muted-foreground px-4 py-3">Commission</th>
                <th className="text-right font-semibold text-muted-foreground px-4 py-3">You Received</th>
                <th className="text-center font-semibold text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingSales ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td colSpan={5} className="px-6 py-4"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No sales yet. List something on the marketplace to get started.</p>
                  </td>
                </tr>
              ) : sales.map((order) => {
                const status = PAYOUT_STATUS[order.payout_status] || PAYOUT_STATUS.pending;
                return (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums font-medium">${Number(order.item_price_aud || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">
                      −${Number(order.platform_fee_aud || 0).toFixed(2)}
                      {order.commission_pct > 0 && <span className="text-xs ml-1">({order.commission_pct}%)</span>}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums font-bold text-emerald-600">${Number(order.seller_proceeds_aud || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant="outline" className={`text-xs font-bold ${status.cls}`}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AccountWallet;
