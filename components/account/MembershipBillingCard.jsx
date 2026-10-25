import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/config/plans.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Account → Membership billing controls for a Stripe-billed member: when the
 * trial ends / the next charge is due, Cancel membership (with undo until the
 * period ends), and Update card. A member whose payment is failing is told so
 * plainly — before this card existed the page showed them the trial sign-up as
 * if they'd never subscribed while Stripe kept retrying their card.
 *
 * Billing state is read live from Stripe (`GET /subscription/stripe/details`);
 * renders nothing when the member has no Stripe subscription.
 */
export default function MembershipBillingCard({ subscriptionStatus, onChanged }) {
  const [membership, setMembership] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null);
  // From the subscription itself: a past_due member's profile already reads Hobby.
  const planName = PLANS[membership?.tier]?.name || 'Pro';

  useEffect(() => {
    let cancelled = false;
    apiServerClient.fetch('/subscription/stripe/details')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setMembership(data?.membership || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [subscriptionStatus]);

  const call = async (action, path, body) => {
    setBusy(action);
    try {
      const res = await apiServerClient.fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again.');
      return data;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    const data = await call('cancel', '/subscription/stripe/cancel');
    if (!data) return;
    setMembership(data.membership);
    toast.success(data.membership?.cancelAtPeriodEnd && data.membership?.periodEndsAt
      ? `Cancelled — you keep ${planName} until ${formatDate(data.membership.periodEndsAt)} and won't be charged again.`
      : 'Your membership is cancelled and you won\'t be charged again.');
    await onChanged?.();
  };

  const handleResume = async () => {
    const data = await call('resume', '/subscription/stripe/resume');
    if (!data) return;
    setMembership(data.membership);
    toast.success(`You're keeping CardPop ${planName}.`);
    await onChanged?.();
  };

  const handleUpdateCard = async () => {
    const data = await call('portal', '/subscription/stripe/portal', { returnUrl: window.location.href });
    if (data?.url) window.location.assign(data.url);
  };

  if (!loaded || !membership || membership.status === 'canceled') return null;

  const pastDue = membership.status === 'past_due' || subscriptionStatus === 'past_due';
  const trialing = membership.status === 'trialing';
  const ending = membership.cancelAtPeriodEnd;
  const when = membership.periodEndsAt ? formatDate(membership.periodEndsAt) : null;
  const price = membership.amountAud != null ? `$${membership.amountAud.toFixed(2)}` : null;

  return (
    <div className={`rounded-card border p-6 ${pastDue ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-border bg-card'}`}>
      {pastDue ? (
        <>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Your last payment didn't go through
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account is on the free Hobby plan until the payment succeeds, and we'll retry the card
            on file. Update your card to restore {planName}, or cancel to stop the charge attempts.
          </p>
        </>
      ) : ending ? (
        <>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <CalendarClock className="h-5 w-5 text-brand-red" />
            Membership cancelled
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {when ? `You keep ${planName} until ${when}` : `You keep ${planName} until the end of this period`}
            , then your account moves to the free Hobby plan. You won't be charged again.
          </p>
        </>
      ) : (
        <>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <CalendarClock className="h-5 w-5 text-brand-red" />
            Billing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {trialing
              ? `Your free trial ends${when ? ` on ${when}` : ''}. ${price ? `Your card will then be charged ${price}/month` : 'Your card will then be charged monthly'} unless you cancel before then.`
              : `${price ? `${price}/month` : 'Billed monthly'}${when ? ` · next charge ${when}` : ''}. Cancel any time — you keep ${planName} until the end of the period you've paid for.`}
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {ending && !pastDue ? (
          <Button type="button" onClick={handleResume} disabled={busy != null} className="bg-brand-red font-bold hover:bg-brand-red/90">
            {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Keep my membership'}
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={busy != null}>
                {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel membership'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel your {planName} membership?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pastDue
                    ? 'Your membership ends now and we stop trying to charge your card. Your account stays on the free Hobby plan — buying and selling still work.'
                    : trialing
                      ? `You keep ${planName} until your trial ends${when ? ` on ${when}` : ''}, and your card is never charged. After that your account moves to the free Hobby plan.`
                      : `You keep ${planName} until ${when || 'the end of this period'} and won't be charged again. After that your account moves to the free Hobby plan.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep membership</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel}>Cancel membership</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button type="button" variant={pastDue ? 'default' : 'ghost'} onClick={handleUpdateCard} disabled={busy != null}>
          {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="mr-2 h-4 w-4" />Update card</>}
        </Button>
      </div>
    </div>
  );
}
