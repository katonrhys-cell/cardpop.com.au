import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext.jsx';

/**
 * Buy-side identity gate for marketplace (peer-to-peer) purchases.
 *
 * Buying a marketplace listing requires a Stripe Identity-verified account —
 * the same trust bar the sell/trade paths enforce, and the server rejects an
 * unverified marketplace checkout regardless (see requireIdentityForPurchase).
 * This surfaces that requirement up front instead of letting the payment step
 * fail, and points the buyer at the right next action:
 *   - signed out            → sign in / register
 *   - signed in, unverified → verify with Stripe (returns here afterwards)
 *
 * CardPop Shop items are unaffected — only render this when the order contains
 * a marketplace listing.
 *
 * Props:
 *   - returnPath: where to send the buyer back to once they've verified
 *                 (defaults to the current path + query).
 */
const MarketplacePurchaseGate = ({ returnPath }) => {
  const { isAuthenticated } = useAuth();
  const backTo = returnPath || `${window.location.pathname}${window.location.search}`;

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="flex flex-col items-center px-6 py-10 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10">
          <ShieldCheck className="h-7 w-7 text-brand-red" />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">
          Verify your identity to buy on the marketplace
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Marketplace items are sold by other collectors, so we verify every buyer and seller with a
          quick ID + selfie check — handled securely by Stripe. It keeps the marketplace safe for
          everyone. CardPop Shop items don't require this.
        </p>

        {isAuthenticated ? (
          <Button
            asChild
            className="mt-6 h-12 w-full max-w-xs bg-brand-red font-bold hover:bg-brand-red/90"
          >
            <Link to={`/verify-identity?next=${encodeURIComponent(backTo)}`}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Verify with Stripe
            </Link>
          </Button>
        ) : (
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <Button asChild className="h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90">
              <Link to="/login" state={{ from: { pathname: backTo } }}>
                <LogIn className="mr-2 h-4 w-4" /> Sign in to continue
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 w-full font-bold">
              <Link to="/signup">Create a free account</Link>
            </Button>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          <Link to="/trust-safety" className="text-primary hover:underline">
            Why we ask for your ID →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};

export default MarketplacePurchaseGate;
