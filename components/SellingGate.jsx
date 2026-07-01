import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TRIAL_DAYS } from '@/config/subscription.js';

/**
 * Gate for listing/selling features.
 *
 * Renders `children` when the current user is entitled to sell (active or
 * trialing subscription, grandfathered account, or an unexpired trial).
 * Otherwise it renders a branded upsell prompt pointing at the subscription
 * page. This is UX only — the database RLS policy `can_sell()` is the real
 * enforcement, so it is safe to fail open here if entitlement is still loading.
 *
 * Props:
 *   - children:  the gated UI (e.g. a ListingForm)
 *   - fallback:  optional custom node to show instead of the default prompt
 */
const SellingGate = ({ children, fallback = null }) => {
  const { isAuthenticated, canSell, profileLoading, trialDaysLeft, trialActive } = useAuth();

  // While we don't yet know entitlement, don't flash the upsell.
  if (profileLoading) return children;

  if (isAuthenticated && canSell) {
    // Gentle reminder while trialing, but never blocks.
    return (
      <>
        {trialActive && trialDaysLeft != null && (
          <div className="mb-4 flex items-center gap-2 rounded-card border border-brand-red/20 bg-brand-red/5 px-4 py-2.5 text-sm text-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-brand-red" />
            <span>
              You have <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}</strong> left on your free trial.
            </span>
          </div>
        )}
        {children}
      </>
    );
  }

  if (fallback) return fallback;

  return (
    <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10">
        <Lock className="h-7 w-7 text-brand-red" />
      </div>
      <h2 className="font-heading text-xl font-bold text-foreground">Start selling on CardPop</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Listing and selling cards is part of a CardPop membership. Start your{' '}
        <strong>{TRIAL_DAYS}-day free trial</strong> — cancel anytime before it ends and you won't be charged.
      </p>
      <Button asChild className="mt-6 h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90">
        <Link to={isAuthenticated ? '/account/membership' : '/signup'}>
          {isAuthenticated ? 'Start free trial' : 'Register free'}
        </Link>
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        {isAuthenticated ? 'Add a payment method to unlock selling.' : 'No charge for 30 days.'}
      </p>
    </div>
  );
};

export default SellingGate;
