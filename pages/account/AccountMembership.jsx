import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import StartTrialOptions from '@/components/StartTrialOptions.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Gift, Loader2, Sparkles } from 'lucide-react';
import { TRIAL_DAYS, TIER_PRICES_AUD, PAID_TIER_ORDER, normalizePaidTier } from '@/config/subscription.js';
import { PLANS, planKeyFromTier } from '@/config/plans.js';

const statusLabel = (subscriptionStatus, tierName) => ({
  trialing:      { label: `${tierName} trial active`, tone: 'text-brand-red', Icon: Sparkles },
  active:        { label: `CardPop ${tierName} active`, tone: 'text-green-600', Icon: BadgeCheck },
  grandfathered: { label: `CardPop ${tierName} active`, tone: 'text-green-600', Icon: BadgeCheck },
  past_due:      { label: 'Payment overdue',   tone: 'text-yellow-600', Icon: Clock },
  canceled:      { label: 'Membership cancelled', tone: 'text-muted-foreground', Icon: Clock },
  none:          { label: 'Hobby (free) plan', tone: 'text-muted-foreground', Icon: Clock },
}[subscriptionStatus]);

const AccountMembership = () => {
  const { isPro, subscriptionStatus, subscriptionTier, trialDaysLeft, refetchProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [activating, setActivating] = useState(false);
  const [welcomeCode, setWelcomeCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeConfirmed, setCodeConfirmed] = useState(false);
  // Which paid tier the member is buying — preselected by /pricing's
  // "?tier=premium" style links, switchable here before checkout.
  const [selectedTier, setSelectedTier] = useState(() => normalizePaidTier(params.get('tier')));

  // Prefill the welcome-code input with the user's own unredeemed code so
  // arriving from the offer email is one click, not a copy-paste hunt.
  useEffect(() => {
    if (isPro) return;
    let cancelled = false;
    apiServerClient.fetch('/welcome-offer/mine')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const offer = data?.offer;
        if (!cancelled && offer?.code && !offer.trial_redeemed_at) setWelcomeCode(offer.code);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isPro]);

  const handleRedeemWelcomeCode = async (e) => {
    e.preventDefault();
    if (!welcomeCode.trim()) { toast.error('Enter your welcome code first.'); return; }
    setRedeeming(true);
    try {
      const res = await apiServerClient.fetch('/welcome-offer/validate-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: welcomeCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not validate the code.');
      setCodeConfirmed(true);
      toast.success('Code confirmed! Add a card or PayPal below to start your free trial.');
    } catch (err) {
      toast.error(err.message || 'Could not validate the code.');
    } finally {
      setRedeeming(false);
    }
  };

  // Handle returns from Stripe / PayPal.
  useEffect(() => {
    const paypalSubId = params.get('subscription_id');
    const trial = params.get('trial');

    const finish = async () => {
      if (paypalSubId) {
        setActivating(true);
        try {
          const res = await apiServerClient.fetch('/subscription/paypal/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: paypalSubId }),
          });
          if (res.ok) toast.success('Your free trial is active. Welcome aboard!');
          else toast.error('We could not confirm your PayPal subscription. Please contact support.');
        } catch {
          toast.error('We could not confirm your PayPal subscription.');
        } finally {
          setActivating(false);
        }
      } else if (trial === 'started') {
        toast.success('Your free trial is active. Welcome aboard!');
      } else if (trial === 'cancelled') {
        toast('Checkout cancelled — you can start your trial anytime.');
      }

      if (paypalSubId || trial) {
        await refetchProfile?.();
        // Clear the query params so a refresh doesn't re-trigger.
        setParams({}, { replace: true });
      }
    };

    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTierName = PLANS[planKeyFromTier(subscriptionTier)]?.name || 'Pro';
  const meta = statusLabel(subscriptionStatus, currentTierName) || statusLabel('none', currentTierName);
  const { Icon } = meta;

  return (
    <AccountPageShell
      documentTitle="Membership | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Membership' }]}
      title="CardPop Membership"
      description={
        <>
          Buying and selling are free on every plan (selling just needs ID verification). The paid
          tiers — Pro, Premium, Elite and Ultimate — unlock a bigger monthly listing allowance, your
          own store page on Local Traders and premium display styles.{' '}
          <Link to="/pricing" className="text-primary hover:underline">Compare plans →</Link>
        </>
      }
    >
      <div className="rounded-card border border-border bg-card p-6">
        <div className={`flex items-center gap-2 font-bold ${meta.tone}`}>
          <Icon className="h-5 w-5" />
          {activating ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</> : meta.label}
        </div>
        {subscriptionStatus === 'trialing' && trialDaysLeft != null && (
          <p className="mt-2 text-sm text-muted-foreground">
            {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left on your free trial.
          </p>
        )}
      </div>

      {!isPro && (
        <>
          <div className="rounded-card border border-brand-red/30 bg-brand-red/5 p-6">
            <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <Gift className="h-5 w-5 text-brand-red" />
              Have a welcome code?
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              New members get a code by email. Redeem it to claim your {TRIAL_DAYS}-day free trial —
              add a card or PayPal to activate, and you won't be charged until the trial ends.
              The same code also gives you 10% off your first order at checkout.
            </p>
            {codeConfirmed ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-green-600">
                <BadgeCheck className="h-4 w-4" />
                Code confirmed — choose Stripe or PayPal below to start your {TRIAL_DAYS} free days.
              </p>
            ) : (
              <form onSubmit={handleRedeemWelcomeCode} className="mt-4 flex gap-2">
                <Input
                  value={welcomeCode}
                  onChange={(e) => setWelcomeCode(e.target.value.toUpperCase())}
                  placeholder="POP-XXXX-XXXX"
                  autoComplete="off"
                  className="font-mono tracking-widest uppercase"
                  aria-label="Welcome code"
                />
                <Button type="submit" disabled={redeeming} className="shrink-0 font-bold">
                  {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
                </Button>
              </form>
            )}
          </div>

          <div>
            <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
              Start your {TRIAL_DAYS}-day free trial
            </h2>

            {/* Tier picker — every paid tier starts with the same free trial. */}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAID_TIER_ORDER.map((tier) => {
                const active = selectedTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active
                        ? 'border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20'
                        : 'border-border bg-card hover:border-brand-red/40'
                    }`}
                  >
                    <span className={`block text-sm font-bold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {PLANS[tier]?.name || tier}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      ${TIER_PRICES_AUD[tier]}/mo
                    </span>
                  </button>
                );
              })}
            </div>

            <StartTrialOptions returnPath="/account/membership" tier={selectedTier} />
          </div>
        </>
      )}
    </AccountPageShell>
  );
};

export default AccountMembership;
