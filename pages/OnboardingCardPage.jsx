import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CreditCard, ShieldCheck, Loader2, CheckCircle2, Lock } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Onboarding step: put a card on file right after signup / ID verification.
//
// A card on file is required to sell or trade (so CardPop can collect its fee
// when a deal completes) and makes buying one-tap. It's NEVER charged until the
// user actually transacts. The step is skippable — they can add one later from
// Account → Wallet, and the selling gate will prompt them again if they haven't.

const OnboardingCardPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Continue destination once done/skipped. A welcome signup lands on the wallet
  // (its identity + saved-card cards reinforce anything skipped, and the Pro
  // upsell is a click away via the plan banner); otherwise the account dashboard.
  const isWelcome = searchParams.get('welcome') === '1';
  const nextPath = isWelcome ? '/account/wallet' : '/account';

  const [status, setStatus] = useState('loading'); // loading | none | saved | starting
  const pollRef = useRef(null);

  const fetchMethods = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch('/wallet/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setStatus((data.paymentMethods || []).length > 0 ? 'saved' : 'none');
        return (data.paymentMethods || []).length > 0;
      }
    } catch {
      /* fall through */
    }
    setStatus((s) => (s === 'loading' ? 'none' : s));
    return false;
  }, []);

  useEffect(() => {
    fetchMethods();
    // Returning from Stripe setup — confirm and poll briefly for the webhook.
    if (searchParams.get('savedCard') === 'success') {
      toast.success('Card saved — you can now sell and trade.');
      let tries = 0;
      const poll = async () => {
        const ok = await fetchMethods();
        tries += 1;
        if (!ok && tries < 5) pollRef.current = setTimeout(poll, 1500);
      };
      poll();
    } else if (searchParams.get('savedCard') === 'cancelled') {
      toast('No problem — you can add a card anytime before you sell.');
    }
    return () => clearTimeout(pollRef.current);
  }, [fetchMethods, searchParams]);

  const addCard = async () => {
    setStatus('starting');
    try {
      const origin = window.location.origin;
      const here = `/onboarding/card${isWelcome ? '?welcome=1' : ''}`;
      const sep = isWelcome ? '&' : '?';
      const res = await apiServerClient.fetch('/wallet/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successUrl: `${origin}${here}${sep}savedCard=success`,
          cancelUrl: `${origin}${here}${sep}savedCard=cancelled`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start card setup');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || 'Could not start card setup');
      setStatus('none');
    }
  };

  return (
    <div className="flex flex-col bg-background font-sans min-h-[calc(100vh-4rem)]">
      <Helmet><title>Add a Card | Card Pop</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="flex-1 flex items-center justify-center p-4 py-12 lg:py-20 bg-muted/20">
        <div className="w-full max-w-md bg-card p-8 md:p-10 border border-border rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
          {status === 'saved' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="font-serif text-2xl font-bold mb-3">You're all set</h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Your card is on file — it won't be charged until you actually buy, sell or trade. You can
                start listing whenever you're ready.
              </p>
              <Button onClick={() => navigate(nextPath)} className="w-full h-12 font-bold">Continue</Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-serif text-2xl font-bold mb-2">Add a card to finish setup</h1>
                <p className="text-muted-foreground">
                  A card on file lets you sell and trade (we only take a small fee when a deal completes)
                  and makes buying one tap. It's <span className="font-semibold text-foreground">never charged
                  until you actually transact</span>.
                </p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-sm">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Required to <span className="text-foreground font-medium">sell or trade</span>, so fees can be collected on completed deals.</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Stored securely by <span className="text-foreground font-medium">Stripe</span> — CardPop never sees your card number.</span>
                </li>
              </ul>

              <Button onClick={addCard} disabled={status === 'starting'} className="w-full h-12 font-bold">
                {status === 'starting'
                  ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Opening secure setup…</>
                  : 'Add a card'}
              </Button>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                <Link to={nextPath} className="hover:underline">Skip for now</Link>
                <p className="mt-2 text-xs">You can add one later from Account → Wallet.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingCardPage;
