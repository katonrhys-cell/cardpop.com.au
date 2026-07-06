import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, IdCard, Camera, Lock, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Post-signup ID verification step, powered by Stripe Identity.
//
// "Start verification" creates a hosted Stripe Identity session on the
// backend and redirects the user to Stripe, where they photograph a
// government ID and a matching selfie. Stripe returns them here, and this
// page polls /stripe/identity/status until the checks resolve. The step is
// skippable — verification gates seller features, not account creation.

const FAILURE_REASONS = {
  document_expired: 'The document you provided has expired.',
  document_type_not_supported: 'That document type isn’t supported — try a passport or driver licence.',
  document_unverified_other: 'We couldn’t verify that document. Try again with clearer photos.',
  selfie_document_missing_photo: 'The document doesn’t include a usable photo of you.',
  selfie_face_mismatch: 'The selfie didn’t match the photo on your document.',
  selfie_unverified_other: 'We couldn’t verify your selfie. Try again in better lighting.',
  consent_declined: 'Verification was cancelled because consent was declined.',
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24; // ~2 minutes of polling before we stop and let them continue

const VerifyIdentityPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Where to send the user once they're done (verified or skipped). A welcome
  // signup continues to the membership page; otherwise an app-internal `next`
  // path, defaulting to the account dashboard.
  const rawNext = searchParams.get('next');
  const nextPath = searchParams.get('welcome') === '1'
    ? '/account/membership?welcome=1'
    : (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account');

  const [status, setStatus] = useState('checking'); // checking | not_started | starting | processing | verified | requires_input
  const [failureReason, setFailureReason] = useState(null);
  const pollCount = useRef(0);
  const pollTimer = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch('/stripe/identity/status');
      if (!res.ok) throw new Error('status fetch failed');
      const data = await res.json();

      if (data.status === 'verified') {
        setStatus('verified');
        return;
      }
      if (data.status === 'processing') {
        setStatus('processing');
        if (pollCount.current < MAX_POLLS) {
          pollCount.current += 1;
          pollTimer.current = setTimeout(fetchStatus, POLL_INTERVAL_MS);
        }
        return;
      }
      if (data.status === 'requires_input' && data.lastError) {
        setFailureReason(FAILURE_REASONS[data.lastError.code] || data.lastError.reason || null);
        setStatus('requires_input');
        return;
      }
      // canceled, or a session that was created but never submitted
      setStatus('not_started');
    } catch {
      // Can't reach the backend — don't trap the user on this page.
      setStatus('not_started');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => clearTimeout(pollTimer.current);
  }, [fetchStatus]);

  const startVerification = async () => {
    setStatus('starting');
    try {
      const res = await apiServerClient.fetch('/stripe/identity/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: `/verify-identity${window.location.search}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (data.code === 'already_verified') { setStatus('verified'); return; }
        throw new Error(data.error || 'Could not start verification');
      }
      window.location.href = data.url; // hand off to Stripe's hosted flow
    } catch (err) {
      toast.error(err.message || 'Could not start verification. Please try again.');
      setStatus(failureReason ? 'requires_input' : 'not_started');
    }
  };

  const Panel = ({ children }) => (
    <div className="flex flex-col bg-background font-sans min-h-[calc(100vh-4rem)]">
      <Helmet><title>Verify Your Identity | Card Pop</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="flex-1 flex items-center justify-center p-4 py-12 lg:py-20 bg-muted/20">
        <div className="w-full max-w-md bg-card p-8 md:p-10 border border-border rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
          {children}
        </div>
      </div>
    </div>
  );

  if (status === 'checking') {
    return (
      <Panel>
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Panel>
    );
  }

  if (status === 'verified') {
    return (
      <Panel>
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-4">Identity Verified</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Your ID check is complete. Your account now carries the Verified badge, building trust with buyers and sellers.
          </p>
          <Button onClick={() => navigate(nextPath)} className="w-full h-12 font-bold">Continue</Button>
        </div>
      </Panel>
    );
  }

  if (status === 'processing') {
    return (
      <Panel>
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-500/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-4">Checking Your Documents</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Stripe is verifying your ID — this usually takes under a minute. You can wait here, or continue
            and we&rsquo;ll notify you when it&rsquo;s done.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Waiting for results…
          </div>
          <Button onClick={() => navigate(nextPath)} variant="outline" className="w-full h-12 font-bold">
            Continue — notify me later
          </Button>
        </div>
      </Panel>
    );
  }

  // not_started / starting / requires_input
  return (
    <Panel>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">Verify Your Identity</h1>
        <p className="text-muted-foreground">
          One last step: confirm you&rsquo;re you. Verified accounts earn the trust badge buyers and sellers look for.
        </p>
      </div>

      {status === 'requires_input' && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-destructive/10 border border-destructive/20 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-destructive">
            {failureReason || 'Your last verification attempt didn’t complete. Please try again.'}
          </p>
        </div>
      )}

      <ul className="space-y-4 mb-8">
        <li className="flex items-start gap-3 text-sm">
          <IdCard className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <span className="text-muted-foreground">Have your <span className="text-foreground font-medium">passport or driver licence</span> ready — you&rsquo;ll photograph it with your phone or webcam.</span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <Camera className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <span className="text-muted-foreground">Take a quick <span className="text-foreground font-medium">selfie</span> so we can match it to your ID.</span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <span className="text-muted-foreground">Verification is handled securely by <span className="text-foreground font-medium">Stripe</span> — CardPop never stores your document images.</span>
        </li>
      </ul>

      <Button onClick={startVerification} disabled={status === 'starting'} className="w-full h-12 font-bold">
        {status === 'starting'
          ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Opening secure verification…</>
          : status === 'requires_input' ? 'Try Again' : 'Start ID Verification'}
      </Button>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link to={nextPath} className="hover:underline">Skip for now</Link>
        <p className="mt-2 text-xs">You can verify any time from Account → Verification. Selling requires a verified identity.</p>
      </div>
    </Panel>
  );
};

export default VerifyIdentityPage;
