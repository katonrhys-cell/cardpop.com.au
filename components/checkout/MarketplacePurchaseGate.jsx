import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, LogIn, UserPlus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Buy-side gate for marketplace (peer-to-peer) purchases.
 *
 * Two levels, decided by utils/marketplaceIdentity.js and enforced server-side
 * by requireIdentityForPurchase.js regardless of what this renders:
 *   - 'account'  → the buyer is signed out. Any marketplace card needs a free
 *                  account (sellers are verified people; buyers must be
 *                  reachable too). Sign in or sign up, then come straight back.
 *   - 'identity' → signed in, but the marketplace items reach the ID-check
 *                  threshold and the buyer hasn't done Stripe Identity yet.
 *
 * CardPop Shop items are never gated. In a mixed cart the shop lines can be
 * paid for now (`onCheckoutShopOnly`) while the cards wait.
 *
 * Props:
 *   - level: 'account' | 'identity'
 *   - thresholdAud: the ID-check threshold, for the explanation copy
 *   - returnPath: where to send the buyer back to afterwards
 *   - shopItemCount: shop lines in the cart (offers "check out shop items only")
 *   - onCheckoutShopOnly: handler for that button
 */
const MarketplacePurchaseGate = ({ level = 'account', thresholdAud, returnPath, shopItemCount = 0, onCheckoutShopOnly }) => {
  const backTo = returnPath || `${window.location.pathname}${window.location.search}`;
  const next = encodeURIComponent(backTo);
  const identity = level === 'identity';
  const threshold = Number(thresholdAud) > 0 ? `$${Number(thresholdAud).toLocaleString('en-AU')}` : null;

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="flex flex-col items-center px-6 py-10 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10">
          {identity ? <ShieldCheck className="h-7 w-7 text-brand-red" /> : <UserPlus className="h-7 w-7 text-brand-red" />}
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">
          {identity ? 'One quick ID check before this purchase' : 'Sign in to buy marketplace cards'}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {identity ? (
            <>
              Marketplace orders {threshold ? `of ${threshold} or more` : ''} need a one-time ID + selfie check,
              handled securely by Stripe. It protects sellers from fraud on high-value cards and takes about
              two minutes — you only ever do it once. CardPop Shop items and Official CardPop Store
              cards don&apos;t need it.
            </>
          ) : (
            <>
              Marketplace cards are sold by other collectors, so every buyer has a free CardPop account —
              it&apos;s how the seller reaches you and how your Buyer Protection is tied to the order.
              Takes a minute; you&apos;ll come straight back here.
            </>
          )}
        </p>

        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          {identity ? (
            <Button asChild className="h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90">
              <Link to={`/verify-identity?next=${next}`}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Verify with Stripe
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild className="h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90">
                <Link to={`/signup?next=${next}`}>
                  <UserPlus className="mr-2 h-4 w-4" /> Create a free account
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full font-bold">
                <Link to="/login" state={{ from: { pathname: backTo } }}>
                  <LogIn className="mr-2 h-4 w-4" /> I already have an account
                </Link>
              </Button>
            </>
          )}
          {shopItemCount > 0 && onCheckoutShopOnly && (
            <Button type="button" variant="ghost" className="h-11 w-full font-semibold" onClick={onCheckoutShopOnly}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Check out {shopItemCount === 1 ? 'the shop item' : `${shopItemCount} shop items`} now
            </Button>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          <Link to="/trust-safety" className="text-primary hover:underline">
            {identity ? 'Why we ask for ID on larger orders →' : 'How CardPop protects buyers →'}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};

export default MarketplacePurchaseGate;
