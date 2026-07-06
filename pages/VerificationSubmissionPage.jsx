import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, ArrowRight, CheckCircle, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { isVerified } from '@/utils/verification.js';
import { Button } from '@/components/ui/button';

// Identity verification is handled entirely by Stripe. When a seller onboards
// with Stripe Connect to receive payouts, Stripe performs the KYC / identity
// checks and only enables payouts once identity is confirmed — CardPop never
// collects or stores government ID documents itself. This page explains that
// and routes users to the Stripe onboarding (which lives in the wallet).

const VerificationSubmissionPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);

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
          setOnboarded(isVerified(profileRes.data?.is_verified) || Boolean(statusRes?.onboarded));
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 lg:py-20 font-sans">
      <Helmet><title>Account Verification | CardPop</title></Helmet>

      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4">Verify Your Identity</h1>
        <p className="text-muted-foreground text-lg text-balance">
          Build trust within the community. Verification protects our marketplace and unlocks advanced seller features.
        </p>
      </div>

      {onboarded ? (
        <div className="bg-card border border-border rounded-3xl shadow-sm p-10 flex flex-col items-center text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mb-6" />
          <h2 className="text-2xl font-serif font-bold mb-3">Identity Verified</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Your identity has been verified through Stripe and your profile displays the Verified badge.
          </p>
          <Button asChild className="rounded-xl font-bold h-12 px-8">
            <Link to="/account/wallet">Go to Wallet</Link>
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 md:p-10 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Verify securely with Stripe</h2>
                <p className="text-sm text-muted-foreground">
                  Identity verification is handled by Stripe as part of seller payout onboarding.
                  You’ll complete a short, secure check on Stripe’s platform, where your government
                  ID is verified directly. CardPop never sees or stores your documents — once Stripe
                  confirms your identity, your Verified badge is applied automatically.
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {[
                'Verified badge on your profile and listings',
                'Documents stay with Stripe, never stored by CardPop',
                'Automatic — no manual review or waiting on an admin',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full h-12 px-8 rounded-xl font-bold gap-2">
              <Link to="/account/wallet">
                Verify with Stripe <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationSubmissionPage;
