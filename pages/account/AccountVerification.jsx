import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, ArrowRight, Lock,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { isVerified } from '@/utils/verification.js';

// Identity verification is handled entirely by Stripe. When a seller onboards
// with Stripe Connect to receive payouts, Stripe performs the KYC / identity
// checks and only enables payouts once identity is confirmed — so CardPop never
// collects or stores government ID documents itself. This page reflects that
// status and routes users to the Stripe onboarding (which lives in the wallet).

const AccountVerification = () => {
  const { currentUser } = useAuth();
  const [verified, setVerified] = useState(false);
  const [connect, setConnect] = useState(null); // { connected, onboarded }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    const run = async () => {
      try {
        const [profileRes, statusRes] = await Promise.all([
          supabase.from('profiles').select('is_verified').eq('id', currentUser.id).maybeSingle(),
          apiServerClient.fetch('/stripe/connect/status').then(r => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (!cancelled) {
          setVerified(isVerified(profileRes.data?.is_verified));
          setConnect(statusRes);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  const onboarded = verified || connect?.onboarded;
  const inProgress = !onboarded && connect?.connected;

  const statusCfg = onboarded
    ? { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Verified',
        note: 'Your identity has been verified through Stripe. Your profile displays the Verified badge.' }
    : inProgress
    ? { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Verification In Progress',
        note: 'You’ve started Stripe onboarding but haven’t finished. Complete it to get verified.' }
    : { icon: ShieldAlert, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Not Verified',
        note: 'Verify your identity through Stripe to unlock the Verified badge and seller features.' };
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Identity Verification | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Verification' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-1">Identity Verification</h1>
        <p className="text-muted-foreground">Verify your identity to unlock the Verified badge and build buyer/seller trust.</p>
      </div>

      {/* Current status */}
      <div className={`flex items-start gap-4 p-5 rounded-2xl border ${statusCfg.bg}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${statusCfg.bg}`}>
          <StatusIcon className={`w-6 h-6 ${statusCfg.color}`} />
        </div>
        <div className="flex-1">
          <p className={`font-bold text-base ${statusCfg.color}`}>{statusCfg.label}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{statusCfg.note}</p>
        </div>
      </div>

      {/* Benefits */}
      {!onboarded && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Why get verified?</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Verified badge on your profile and listings',
              'Increased buyer & seller trust',
              'Badge shown on offers and bids',
              'Access to higher transaction limits',
            ].map(b => (
              <div key={b} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works / CTA */}
      {!onboarded ? (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Verify securely with Stripe</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Identity verification is handled by Stripe as part of seller payout onboarding.
                Stripe checks your government ID directly on their secure, regulated platform —
                CardPop never sees or stores your documents. Once Stripe confirms your identity,
                your Verified badge is applied automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Your identity documents are collected and verified by Stripe, a PCI-certified payments provider. They are never uploaded to or stored by CardPop.</p>
          </div>

          <Button asChild className="w-full h-12 font-bold rounded-xl gap-2">
            <Link to="/account/wallet">
              {inProgress ? 'Finish Stripe verification' : 'Verify with Stripe'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <p className="font-bold">You’re verified</p>
            <p className="text-sm text-muted-foreground">Manage your payout account any time from your <Link to="/account/wallet" className="text-primary font-bold hover:underline">Wallet</Link>.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountVerification;
