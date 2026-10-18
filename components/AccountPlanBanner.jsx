import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ShieldCheck, CreditCard, Sparkles, ArrowRight, Check, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { PLANS, PLAN_ORDER, PLAN_HOBBY, planKeyFromTier, planRank, isTopPlan, nextPlanFor } from '@/config/plans.js';

/**
 * Compact plan-and-next-steps banner for the account dashboard.
 *
 *   • shows which plan the account is on (Hobby, Pro, Premium, Elite or
 *     Ultimate) with the whole ladder beside it, the current step marked
 *   • offers "Upgrade your plan" to everyone except Ultimate members — the
 *     link preselects the next step up on Account → Membership, where a paid
 *     member switches tier in place and a Hobby member starts a trial
 *   • nudges Hobby users to verify their ID (to unlock selling/trading) and
 *     sellers to keep a card on file for one-tap buying
 */
const AccountPlanBanner = () => {
  const { currentUser, isPro, isIdentityVerified, hasSavedCard, trialActive, trialDaysLeft, subscriptionTier } = useAuth();
  const currentPlanKey = isPro ? planKeyFromTier(subscriptionTier) : PLAN_HOBBY;
  const currentPlan = PLANS[currentPlanKey];
  const currentRank = planRank(currentPlanKey);
  const topPlan = isTopPlan(currentPlanKey);
  const nextPlan = nextPlanFor(currentPlanKey);

  // The selling nudges only make sense for someone who has listed (or is set
  // up to sell); a buyer saw them on every visit for steps that did nothing
  // for them.
  const [isSeller, setIsSeller] = React.useState(isIdentityVerified && hasSavedCard);
  React.useEffect(() => {
    if (!currentUser?.id || isSeller) return undefined;
    let cancelled = false;
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', currentUser.id)
      .then(({ count }) => { if (!cancelled && (count || 0) > 0) setIsSeller(true); }, () => {});
    return () => { cancelled = true; };
  }, [currentUser?.id, isSeller]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isPro ? 'bg-brand-red/10' : 'bg-muted'}`}>
            {topPlan
              ? <Crown className="h-5 w-5 text-brand-red" />
              : isPro
                ? <Sparkles className="h-5 w-5 text-brand-red" />
                : <BadgeCheck className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your plan</p>
            <p className="font-heading text-lg font-bold text-foreground">
              {isPro ? `CardPop ${currentPlan.name}` : 'Hobby (free)'}
              {trialActive && trialDaysLeft != null && (
                <span className="ml-2 text-sm font-semibold text-brand-red">· {trialDaysLeft} trial {trialDaysLeft === 1 ? 'day' : 'days'} left</span>
              )}
            </p>
            {topPlan ? (
              <p className="text-sm text-muted-foreground">You're on our top plan — unlimited listings and every display style.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Next up: <span className="font-semibold text-foreground">{PLANS[nextPlan].name}</span> — {PLANS[nextPlan].tagline}
              </p>
            )}
          </div>
        </div>
        {!topPlan && (
          <Button asChild className="bg-brand-red font-bold hover:bg-brand-red/90">
            <Link to={`/account/membership?tier=${nextPlan}`}>Upgrade your plan <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        )}
      </div>

      {/* The plan ladder — where this account sits and what each step costs.
          Every step is a link to the membership page with that tier
          preselected; the current one just links to Membership. */}
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Plan options">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const isCurrent = key === currentPlanKey;
          const isBelow = planRank(key) < currentRank;
          const to = isCurrent || key === PLAN_HOBBY ? '/account/membership' : `/account/membership?tier=${key}`;
          return (
            <li key={key}>
              <Link
                to={to}
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex h-full flex-col rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  isCurrent
                    ? 'border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20'
                    : isBelow
                      ? 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      : 'border-border bg-card hover:border-brand-red/40'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`font-bold ${isCurrent || !isBelow ? 'text-foreground' : ''}`}>{plan.name}</span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      <Check className="h-3 w-3" /> Current
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {plan.priceAud ? `$${plan.priceAud}/mo` : 'Free'}
                  {' · '}
                  {plan.limits.listingsPerMonth == null ? 'Unlimited listings' : `${plan.limits.listingsPerMonth} listings/mo`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Next-step nudges — the two steps that unlock selling. Buyers who have
          never listed see neither; their account works as is. */}
      {(isSeller || !isIdentityVerified) && (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {!isIdentityVerified && (
          <Link
            to="/verify-identity"
            className="flex items-center gap-3 rounded-xl border border-brand-red/30 bg-brand-red/5 px-4 py-3 text-sm transition-colors hover:bg-brand-red/10"
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-red" />
            <span className="text-foreground">
              <span className="font-bold">Verify your ID</span> to sell on the marketplace (and for larger purchases) — free, takes about two minutes.
            </span>
          </Link>
        )}
        <Link
          to="/account/wallet"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
            hasSavedCard
              ? 'border-border bg-muted/30 hover:bg-muted/50'
              : 'border-brand-red/30 bg-brand-red/5 hover:bg-brand-red/10'
          }`}
        >
          <CreditCard className={`h-5 w-5 shrink-0 ${hasSavedCard ? 'text-muted-foreground' : 'text-brand-red'}`} />
          <span className="text-foreground">
            {hasSavedCard ? (
              <><span className="font-bold">Manage your saved card</span> — used for one-tap checkout.</>
            ) : (
              <><span className="font-bold">Add a card on file</span> to sell or trade — never charged until you transact.</>
            )}
          </span>
        </Link>
      </div>
      )}
    </div>
  );
};

export default AccountPlanBanner;
