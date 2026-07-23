import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ShieldCheck, CreditCard, CheckCircle2, Circle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Inline notice shown wherever a seller is about to make a card public but
 * can't yet: selling requires Stripe Identity verification AND a card on file
 * (the `can_sell()` RLS gate on `listings`). Without this warning the listing
 * write is silently denied and the seller believes their card is live.
 *
 * Self-hiding: renders nothing while entitlement is unknown (fail-open — the
 * DB policy is the hard gate) or once the user can sell. The step links open in a new tab
 * on purpose — the listing form has no draft autosave, so navigating away
 * would lose everything the seller has entered. "Check again" refetches the
 * profile so `canSell` picks up steps completed in the other tab.
 */
const Step = ({ done, icon: Icon, title, cta, to, children }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 shrink-0">
      {done
        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label={`${title} — done`} />
        : <Circle className="h-5 w-5 text-muted-foreground" aria-label={`${title} — not done`} />}
    </div>
    <div className="flex-1">
      <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
        <Icon className="h-4 w-4 text-brand-red" /> {title}
      </p>
      {!done && (
        <div className="mt-1 text-xs text-muted-foreground">
          {children}
          <div className="mt-2">
            <Button asChild size="sm" variant="outline" className="h-8 font-bold">
              <Link to={to} target="_blank" rel="noopener">{cta}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  </div>
);

const SellingRequirementsNotice = ({ className = '' }) => {
  const { canSell, profileLoading, isIdentityVerified, hasSavedCard, refetchProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  if (profileLoading || canSell) return null;

  const recheck = async () => {
    setChecking(true);
    try {
      await refetchProfile?.();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-400/50 bg-amber-500/5 p-4 space-y-3 ${className}`}
    >
      <div>
        <p className="text-sm font-bold text-foreground">Two quick steps before this card can go live</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          You can still save it now — it stays safely in your vault, and goes live once these are done.
          Selling is free; you only pay a small fee when a sale completes.
        </p>
      </div>

      <Step done={isIdentityVerified} icon={ShieldCheck} title="Verify your identity" cta="Verify identity" to="/verify-identity">
        A quick ID + selfie check, handled securely by Stripe. Opens in a new tab so you don't lose this form.
      </Step>

      <Step done={hasSavedCard} icon={CreditCard} title="Add a card on file" cta="Add a card" to="/account/wallet">
        Needed so the fee can be collected when a sale or trade completes — it's never charged before then.
        Opens in a new tab so you don't lose this form.
      </Step>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 font-bold text-muted-foreground"
        onClick={recheck}
        disabled={checking}
      >
        {checking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
        I've finished these — check again
      </Button>
    </div>
  );
};

export default SellingRequirementsNotice;
