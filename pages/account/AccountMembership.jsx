import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import StartTrialOptions from '@/components/StartTrialOptions.jsx';
import MembershipBillingCard from '@/components/account/MembershipBillingCard.jsx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowUpRight, BadgeCheck, Clock, Crown, Loader2, Sparkles } from 'lucide-react';
import { TIER_PRICES_AUD, PAID_TIER_ORDER, normalizePaidTier } from '@/config/subscription.js';
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
  // Which paid plan the member is buying — preselected by /pricing's and the
  // dashboard's "?tier=ultimate" style links, switchable here before checkout.
  const [selectedTier, setSelectedTier] = useState(() => normalizePaidTier(params.get('tier')));
  // A paid member upgrading in place: which tier is being switched to.
  const [upgrading, setUpgrading] = useState(null);

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
          if (res.ok) toast.success('Your membership is active. Welcome aboard!');
          else toast.error('We could not confirm your PayPal subscription. Please contact support.');
        } catch {
          toast.error('We could not confirm your PayPal subscription.');
        } finally {
          setActivating(false);
        }
      } else if (trial === 'started') {
        toast.success('Payment received — your membership is active. Welcome aboard!');
      } else if (trial === 'cancelled') {
        toast('Checkout cancelled — nothing was charged. You can join anytime.');
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
  const complimentary = subscriptionStatus === 'grandfathered';
  // Plans a paid member can switch to — up or down. A plan change re-prices the
  // existing yearly subscription, so it goes through its own endpoint, not the
  // sign-up checkout. A complimentary plan is managed by
  // CardPop, so it only ever shows what sits above it (disabled).
  const changeOptions = !isPro ? [] : complimentary
    ? upgradePlansFor(currentPlanKey)
    : PAID_TIER_ORDER.filter((tier) => tier !== currentPlanKey);
  const onTopPlan = complimentary && isTopPlan(currentPlanKey);
  const currentRank = PAID_TIER_ORDER.indexOf(currentPlanKey);
  // A member Stripe is billing (or trying to): show the billing controls, and
  // never the trial sign-up to someone whose payment is merely failing.
  const billed = !complimentary && ['trialing', 'active', 'past_due'].includes(subscriptionStatus);
  const pastDue = subscriptionStatus === 'past_due';

  const handleChangePlan = async (tier) => {
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
          <span className="block">
            Hobby is free, and always will be — buying and selling need no membership (selling just
            needs ID verification).
          </span>
          <span className="mt-3 block">
            <strong className="font-bold text-foreground">Pro ($99 a year)</strong> is for vendors and
            avid traders: 30 listings a month, your own store page and the Pro display styles.
          </span>
          <span className="mt-3 block">
            <strong className="font-bold text-foreground">Ultimate ($199 a year)</strong> is for show
            organisers: every event you run is featured on the calendar, with unlimited listings.
          </span>
          <span className="mt-3 block text-base">
            Every price is the full price: GST is included, and CardPop pays Stripe&rsquo;s standard
            card processing fee out of it &mdash; nothing is added at checkout.{' '}
            <Link to="/pricing" className="text-primary hover:underline">Compare plans →</Link>
          </span>
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
                Ultimate includes unlimited listings, every display style and Calendar Spotlight on
                your events — there's nothing above it
                {complimentary ? ', and nothing to pay' : ''}.
              </p>
            </>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
                <ArrowUpRight className="h-5 w-5 text-brand-red" />
                {complimentary ? 'Upgrade your plan' : 'Change your plan'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {complimentary
                  ? 'Your complimentary membership is managed by CardPop — contact support to change it.'
                  : 'Move up or down any time, and the change applies straight away. Upgrading charges your card today for the difference over the rest of your year; downgrading credits the unused part of your current plan against your next renewal. Your renewal date stays the same. To stop paying altogether, cancel your membership above.'}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {changeOptions.map((key) => {
                  const plan = PLANS[key];
                  const preselected = normalizePaidTier(params.get('tier')) === key;
                  const busy = upgrading === key;
                  const verb = PAID_TIER_ORDER.indexOf(key) > currentRank ? 'Upgrade' : 'Downgrade';
                  return (
                    <div
                      key={key}
                      className={`flex flex-col rounded-xl border p-4 ${
                        preselected ? 'border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20' : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-heading text-base font-bold text-foreground">{plan.name}</span>
                        <span className="text-sm font-semibold text-foreground">${TIER_PRICES_AUD[key]}/yr</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {plan.features.slice(1, 4).map((f) => (
                          <li key={f} className="flex gap-1.5"><BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" />{f}</li>
                        ))}
                      </ul>
                      <Button
                        type="button"
                        onClick={() => handleChangePlan(key)}
                        disabled={complimentary || upgrading != null}
                        className="mt-4 w-full bg-brand-red font-bold hover:bg-brand-red/90"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `${complimentary ? 'Switch' : verb} to ${plan.name}`}
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
          <div>
            <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
              Choose your membership
            </h2>

            {/* Plan picker — both plans are one yearly payment, charged at sign-up. */}
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                      ${TIER_PRICES_AUD[tier]} a year · {PLANS[tier]?.audience}
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
