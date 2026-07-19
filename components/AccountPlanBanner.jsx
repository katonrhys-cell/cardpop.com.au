import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ShieldCheck, CreditCard, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';

/**
 * Compact plan-and-next-steps banner for the account dashboard.
 *
 * Reflects CardPop's Hobby-vs-Pro model at a glance:
 *   • shows whether the account is on Hobby (free) or Pro
 *   • nudges Hobby users to verify their ID (to unlock selling/trading)
 *   • nudges everyone to save a card for one-tap buying
 *   • offers the Pro upgrade
 */
const AccountPlanBanner = () => {
  const { isPro, isIdentityVerified, hasSavedCard, trialActive, trialDaysLeft } = useAuth();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isPro ? 'bg-brand-red/10' : 'bg-muted'}`}>
            {isPro ? <Sparkles className="h-5 w-5 text-brand-red" /> : <BadgeCheck className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your plan</p>
            <p className="font-heading text-lg font-bold text-foreground">
              {isPro ? 'CardPop Pro' : 'Hobby (free)'}
              {trialActive && trialDaysLeft != null && (
                <span className="ml-2 text-sm font-semibold text-brand-red">· {trialDaysLeft} trial {trialDaysLeft === 1 ? 'day' : 'days'} left</span>
              )}
            </p>
          </div>
        </div>
        {!isPro && (
          <Button asChild className="bg-brand-red font-bold hover:bg-brand-red/90">
            <Link to="/account/membership">Upgrade to Pro <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        )}
      </div>

      {/* Next-step nudges — both are required to unlock selling & trading */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {!isIdentityVerified && (
          <Link
            to="/verify-identity"
            className="flex items-center gap-3 rounded-xl border border-brand-red/30 bg-brand-red/5 px-4 py-3 text-sm transition-colors hover:bg-brand-red/10"
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-red" />
            <span className="text-foreground">
              <span className="font-bold">Verify your ID</span> to unlock selling &amp; trading — free, takes a minute.
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
    </div>
  );
};

export default AccountPlanBanner;
