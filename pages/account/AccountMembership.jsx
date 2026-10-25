import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import StartTrialOptions from '@/components/StartTrialOptions.jsx';
import MembershipBillingCard from '@/components/account/MembershipBillingCard.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowUpRight, BadgeCheck, Clock, Crown, Gift, Loader2, Sparkles } from 'lucide-react';
import { TRIAL_DAYS, TIER_PRICES_AUD, PAID_TIER_ORDER, normalizePaidTier } from '@/config/subscription.js';
import { PLANS, planKeyFromTier, isTopPlan, upgradePlansFor } from '@/config/plans.js';

const statusLabel = (subscriptionStatus, tierName) => ({
  trialing:      { label: `${tierName} trial active`, tone: 'text-brand-red', Icon: Sparkles },
  active:        { label: `CardPop ${tierName} active`, tone: 'text-green-600', Icon: BadgeCheck },
  grandfathered: { label: `CardPop ${tierName} · complimentary`, tone: 'text-green-600', Icon: BadgeCheck },
  past_due:      { label: 'Payment overdue',   tone: 'text-yellow-600', Icon: Clock },
  canceled:      { label: 'Membership cancelled', tone: 'text-muted-foreground', Icon: Clock },
  none:          { label: 'Hobby (free) plan', tone: 'text-muted-foreground', Icon: Clock },
}[subscriptionStatus]);

const AccountMembership = () => {
  const { isPro, isAdmin, subscriptionStatus, subscriptionTier, trialDaysLeft, refetchProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [activating, setActivating] = useState(false);
  const [welcomeCode, setWelcomeCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeConfirmed, setCodeConfirmed] = useState(false);
  // Which paid tier the member is buying — preselected by /pricing's and the
  // dashboard's "?tier=premium" style links, switchable here before checkout.
  const [selectedTier, setSelectedTier] = useState(() => normalizePaidTier(params.get('tier')));
  // A paid member upgrading in place: which tier is being switched to.
  const [upgrading, setUpgrading] = useState(null);

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
      toast.success('Code confirmed! Add a card below to start your free trial.');
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

  const currentPlanKey = planKeyFromTier(subscriptionTier);
  const currentTierName = PLANS[currentPlanKey]?.name || 'Pro';
  const meta = statusLabel(subscriptionStatus, currentTierName) || statusLabel('none', currentTierName);
  const { Icon } = meta;
  // Tiers a paid member can move up to. A tier change re-prices the existing
  // subscription (no second trial), so it goes through its own endpoint, not
  // the trial checkout.
  const upgradeOptions = isPro ? upgradePlansFor(currentPlanKey) : [];
  const onTopPlan = isPro && isTopPlan(currentPlanKey);
  const complimentary = subscriptionStatus === 'grandfathered';
  // A member Stripe is billing (or trying to): show the billing controls, and
  // never the trial sign-up to someone whose payment is merely failing.
  const billed = !complimentary && ['trialing', 'active', 'past_due'].includes(subscriptionStatus);
  const pastDue = subscriptionStatus === 'past_due';

  const handleUpgrade = async (tier) => {
    setUpgrading(tier);
    try {
      const res = await apiServerClient.fetch('/subscription/stripe/change-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not change your plan.');
      await refetchProfile?.();
      toast.success(`You're now on CardPop ${PLANS[data.tier]?.name || PLANS[tier].name}.`);
      setParams({}, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Could not change your plan.');
    } finally {
      setUpgrading(null);
    }
  };

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
        {complimentary && (
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? 'Every CardPop admin holds the Ultimate plan at no charge — it comes with your admin access, and you are never billed for it.'
              : 'CardPop covers this membership — you are never billed for it.'}
          </p>
        )}
      </div>

      {billed && <MembershipBillingCard subscriptionStatus={subscriptionStatus} onChanged={refetchProfile} />}

      {isPro && (
        <div className="rounded-card border border-border bg-card p-6">
          {onTopPlan ? (
            <>
              <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
                <Crown className="h-5 w-5 text-brand-red" />
                You're on our top plan
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Ultimate includes unlimited listings and every display style — there's nothing above it
                {complimentary ? ', and nothing to pay' : ''}.
              </p>
            </>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
                <ArrowUpRight className="h-5 w-5 text-brand-red" />
                Upgrade your plan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {complimentary
                  ? 'Your complimentary membership is managed by CardPop — contact support to change it.'
                  : 'Switch tiers any time. The change applies straight away and the difference is pro-rated on your next invoice; your trial, if you have one, carries over.'}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {upgradeOptions.map((key) => {
                  const plan = PLANS[key];
                  const preselected = normalizePaidTier(params.get('tier')) === key;
                  const busy = upgrading === key;
                  return (
                    <div
                      key={key}
                      className={`flex flex-col rounded-xl border p-4 ${
                        preselected ? 'border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20' : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-heading text-base font-bold text-foreground">{plan.name}</span>
                        <span className="text-sm font-semibold text-foreground">${TIER_PRICES_AUD[key]}/mo</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {plan.features.slice(1, 4).map((f) => (
                          <li key={f} className="flex gap-1.5"><BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" />{f}</li>
                        ))}
                      </ul>
                      <Button
                        type="button"
                        onClick={() => handleUpgrade(key)}
                        disabled={complimentary || upgrading != null}
                        className="mt-4 w-full bg-brand-red font-bold hover:bg-brand-red/90"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Switch to ${plan.name}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <Link to="/pricing" className="text-primary hover:underline">Compare every plan →</Link>
              </p>
            </>
          )}
        </div>
      )}

      {!isPro && !pastDue && (
        <>
          <div className="rounded-card border border-brand-red/30 bg-brand-red/5 p-6">
            <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <Gift className="h-5 w-5 text-brand-red" />
              Have a welcome code?
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              New members get a code by email. Redeem it to claim your {TRIAL_DAYS}-day free trial —
              add a card to activate, and you won't be charged until the trial ends.
              The same code also gives you 10% off your first order at checkout.
            </p>
            {codeConfirmed ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-green-600">
                <BadgeCheck className="h-4 w-4" />
                Code confirmed — add your card below to start your {TRIAL_DAYS} free days.
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
