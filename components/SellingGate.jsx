import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Gate for listing/selling/trading features.
 *
 * In CardPop's model, selling is free on every plan (Hobby included) but
 * requires Stripe Identity verification first. So this renders `children` once
 * the current user is identity-verified (`canSell`), and otherwise shows a
 * branded prompt pointing at the ID-verification flow. This is UX only — the
 * database RLS policy `can_sell()` (now keyed on identity) is the real
 * enforcement, so it's safe to fail open while entitlement is still loading.
 *
 * Props:
 *   - children:  the gated UI (e.g. a ListingForm)
 *   - fallback:  optional custom node to show instead of the default prompt
 */
const SellingGate = ({ children, fallback = null }) => {
  const { isAuthenticated, canSell, profileLoading } = useAuth();

  // While we don't yet know entitlement, don't flash the upsell.
  if (profileLoading) return children;

  if (isAuthenticated && canSell) return children;

  if (fallback) return fallback;

  return (
    <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10">
        <ShieldCheck className="h-7 w-7 text-brand-red" />
      </div>
      <h2 className="font-heading text-xl font-bold text-foreground">Verify your ID to start selling</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Listing, selling and trading on CardPop are free — you only pay a small fee when a sale
        completes. First, confirm it's really you with a quick ID + selfie check, handled securely by{' '}
        <strong>Stripe</strong>.
      </p>
      <Button asChild className="mt-6 h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90">
        <Link to={isAuthenticated ? '/verify-identity' : '/signup'}>
          {isAuthenticated ? 'Verify my identity' : 'Register free'}
        </Link>
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        {isAuthenticated ? 'Takes about a minute — CardPop never stores your document images.' : "It's free to join."}
      </p>
    </div>
  );
};

export default SellingGate;
