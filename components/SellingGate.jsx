import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ShieldCheck, CreditCard, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Gate for listing/selling/trading features.
 *
 * Selling is free on every plan (Hobby included) but requires two things first:
 *   1. Stripe Identity verification (`isIdentityVerified`)
 *   2. A card on file (`hasSavedCard`) — never charged until a sale/trade
 *      completes, but required so the per-transaction fee can be collected.
 *
 * `canSell` is the AND of both. This renders `children` once the user can sell,
 * otherwise a two-step checklist pointing at whatever is still missing. UX only
 * — the DB RLS policy `can_sell()` enforces the same rule, so it's safe to fail
 * open while entitlement is still loading.
 *
 * Props:
 *   - children:  the gated UI (e.g. a ListingForm)
 *   - fallback:  optional custom node to show instead of the default prompt
 */
const Step = ({ done, icon: Icon, title, children }) => (
  <div className={`flex items-start gap-3 rounded-xl border p-4 text-left ${done ? 'border-emerald-400/40 bg-emerald-500/5' : 'border-border bg-muted/30'}`}>
    <div className="mt-0.5 shrink-0">
      {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
    </div>
    <div className="flex-1">
      <p className="flex items-center gap-1.5 font-bold text-foreground">
        <Icon className="h-4 w-4 text-brand-red" /> {title}
      </p>
      {!done && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  </div>
);

const SellingGate = ({ children, fallback = null }) => {
  const { isAuthenticated, canSell, profileLoading, isIdentityVerified, hasSavedCard } = useAuth();

  // While we don't yet know entitlement, don't flash the upsell.
  if (profileLoading) return children;

  if (isAuthenticated && canSell) return children;

  if (fallback) return fallback;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10">
          <ShieldCheck className="h-7 w-7 text-brand-red" />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">Sell on CardPop</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It's free to join. Listing and selling are free too — you only pay a small fee when a sale
          completes.
        </p>
        <Button asChild className="mt-6 h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90">
          <Link to="/signup">Register free</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 shadow-sm">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10">
          <ShieldCheck className="h-7 w-7 text-brand-red" />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">Two quick steps to start selling</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Selling and trading are free — you only pay a small fee when a deal completes. First, finish
          these:
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <Step done={isIdentityVerified} icon={ShieldCheck} title="Verify your identity">
          A quick ID + selfie check, handled securely by Stripe.
          <div className="mt-2">
            <Button asChild size="sm" className="h-9 bg-brand-red font-bold hover:bg-brand-red/90">
              <Link to="/verify-identity">Verify identity</Link>
            </Button>
          </div>
        </Step>

        <Step done={hasSavedCard} icon={CreditCard} title="Add a card on file">
          Needed so we can collect the fee when a sale or trade completes. It's{' '}
          <span className="font-semibold text-foreground">never charged until you actually transact</span>.
          <div className="mt-2">
            <Button asChild size="sm" variant="outline" className="h-9 font-bold">
              <Link to="/account/wallet">Add a card</Link>
            </Button>
          </div>
        </Step>
      </div>
    </div>
  );
};

export default SellingGate;
