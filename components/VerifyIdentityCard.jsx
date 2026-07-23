import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

/**
 * "Verify with Stripe" — the identity check required before buying, selling or
 * trading. It sits alongside "Add a card on file": together they are the two
 * prerequisites the `SellingRequirementsNotice` / DB `can_sell()` rule enforce.
 *
 * Starting verification creates a hosted Stripe Identity session on the backend
 * (POST /stripe/identity/session) and redirects to Stripe, where the user
 * photographs a government ID + matching selfie. Stripe returns them to
 * /account/wallet; on return we poll /stripe/identity/status — which re-syncs
 * the profile — and refresh auth so the badge here (and the selling gate) flip
 * without a manual reload. CardPop never stores the document images.
 */
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
const MAX_POLLS = 24; // ~2 minutes of polling before we stop

const VerifyIdentityCard = () => {
  const { isIdentityVerified, refetchProfile } = useAuth();
  // verified | processing | requires_input | not_started | checking | starting
  const [status, setStatus] = useState(isIdentityVerified ? 'verified' : 'checking');
  const [failureReason, setFailureReason] = useState(null);
  const [starting, setStarting] = useState(false);
  const pollCount = useRef(0);
  const pollTimer = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch('/stripe/identity/status');
      if (!res.ok) throw new Error('status fetch failed');
      const data = await res.json();

      if (data.status === 'verified') {
        setStatus('verified');
        // Re-sync auth so the selling gate / badges reflect the new state.
        refetchProfile?.();
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
      setStatus('not_started');
    } catch {
      // Can't reach the backend — fall back to the profile flag we already have.
      setStatus(isIdentityVerified ? 'verified' : 'not_started');
    }
  }, [isIdentityVerified, refetchProfile]);

  useEffect(() => {
    if (isIdentityVerified) { setStatus('verified'); return; }
    fetchStatus();

    // Returning from Stripe's hosted flow — nudge a refresh and toast.
    const params = new URLSearchParams(window.location.search);
    if (params.get('identity') === 'success') {
      toast.success('Thanks — we’re confirming your ID with Stripe now.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    return () => clearTimeout(pollTimer.current);
  }, [isIdentityVerified, fetchStatus]);

  const startVerification = async () => {
    setStarting(true);
    try {
      const res = await apiServerClient.fetch('/stripe/identity/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: '/account/wallet?identity=success' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (data.code === 'already_verified') { setStatus('verified'); refetchProfile?.(); return; }
        throw new Error(data.error || 'Could not start identity verification');
      }
      window.location.href = data.url; // hand off to Stripe's hosted flow
    } catch (err) {
      toast.error(err.message || 'Could not start identity verification. Please try again.');
      setStarting(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <ShieldCheck className="h-4 w-4 text-brand-red" /> Identity verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Verify your identity with Stripe before you buy, sell or trade. It's a quick photo of a
          government ID and a matching selfie —{' '}
          <span className="font-semibold text-foreground">handled securely by Stripe</span>, and CardPop
          never stores your document images.
        </p>

        {status === 'verified' ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/5 px-4 py-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Your identity is verified — you're cleared to transact.
            </span>
          </div>
        ) : status === 'processing' ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/5 px-4 py-3 text-sm">
            <Clock className="h-5 w-5 shrink-0 text-amber-500" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Stripe is checking your documents — this usually takes under a minute.
            </span>
          </div>
        ) : (
          <>
            {status === 'requires_input' && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-destructive">
                  {failureReason || 'Your last verification attempt didn’t complete. Please try again.'}
                </p>
              </div>
            )}
            <Button
              onClick={startVerification}
              disabled={starting || status === 'checking'}
              className="h-11 w-full bg-brand-red font-bold hover:bg-brand-red/90"
            >
              {starting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening secure verification…</>
                : status === 'checking'
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking status…</>
                  : <><ShieldCheck className="mr-2 h-4 w-4" /> {status === 'requires_input' ? 'Try again' : 'Verify with Stripe'}</>}
            </Button>
          </>
        )}

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Required before buying, selling or trading.
        </p>
      </CardContent>
    </Card>
  );
};

export default VerifyIdentityCard;
