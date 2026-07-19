import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, CreditCard, Sparkles, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { PLANS, PLAN_HOBBY, PLAN_PRO } from '@/config/plans.js';
import { TRIAL_DAYS } from '@/config/subscription.js';

// Public pricing page: Hobby (free) vs Pro. Anyone can browse and buy; listing,
// selling and trading unlock after a quick Stripe Identity check on either plan.
// Pro is the optional paid upgrade for premium features, higher limits and a
// full storefront.

const PlanCard = ({ plan, highlighted, cta }) => (
  <div
    className={`relative flex flex-col rounded-2xl border p-8 ${
      highlighted
        ? 'border-brand-red/50 bg-card shadow-lg ring-1 ring-brand-red/20'
        : 'border-border bg-card'
    }`}
  >
    {highlighted && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-red px-3 py-1 text-xs font-bold text-white">
        Most popular
      </span>
    )}
    <h2 className="font-heading text-2xl font-bold text-foreground">{plan.name}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
    <div className="mt-5 flex items-end gap-1">
      {plan.priceAud > 0 ? (
        <>
          <span className="font-heading text-4xl font-extrabold text-foreground">${plan.priceAud}</span>
          <span className="mb-1 text-sm text-muted-foreground">/{plan.interval} AUD</span>
        </>
      ) : (
        <span className="font-heading text-4xl font-extrabold text-foreground">Free</span>
      )}
    </div>
    {plan.trialDays ? (
      <p className="mt-1 text-xs font-semibold text-brand-red">
        {plan.trialDays}-day free trial — cancel anytime
      </p>
    ) : (
      <p className="mt-1 text-xs text-muted-foreground">No card required to start</p>
    )}

    <ul className="mt-6 flex-1 space-y-3">
      {plan.features.map((feature) => (
        <li key={feature} className="flex items-start gap-2.5 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <span className="text-foreground">{feature}</span>
        </li>
      ))}
    </ul>

    <div className="mt-8">{cta}</div>
  </div>
);

const PricingPage = () => {
  const { isAuthenticated, isPro } = useAuth();
  const hobby = PLANS[PLAN_HOBBY];
  const pro = PLANS[PLAN_PRO];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Helmet>
        <title>Pricing — Hobby &amp; Pro | CardPop</title>
        <meta
          name="description"
          content="CardPop is free to join. Buy instantly, and sell once your ID is verified — paying only a small fee per sale. Upgrade to Pro for unlimited listings, a storefront and premium tools."
        />
      </Helmet>

      <div className="text-center">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">Simple, fair pricing</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Joining CardPop is free, forever. Browse and buy right away. To list, sell or trade, just
          verify your identity — then you only pay a small fee when a sale or trade completes. Go Pro
          when you want the full seller toolkit.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <PlanCard
          plan={hobby}
          highlighted={false}
          cta={
            <Button
              asChild
              variant="outline"
              className="h-12 w-full border-2 font-bold"
            >
              <Link to={isAuthenticated ? '/account' : '/signup'}>
                {isAuthenticated ? 'Your account' : 'Create free account'}
              </Link>
            </Button>
          }
        />
        <PlanCard
          plan={pro}
          highlighted
          cta={
            <Button
              asChild
              className="h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90"
            >
              <Link to={isAuthenticated ? '/account/membership' : '/signup'}>
                {isPro ? 'Manage Pro' : isAuthenticated ? `Start ${TRIAL_DAYS}-day Pro trial` : 'Get started with Pro'}
              </Link>
            </Button>
          }
        />
      </div>

      {/* How it works */}
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <CreditCard className="h-6 w-6 text-brand-red" />
          <h3 className="mt-3 font-heading font-bold text-foreground">Buy with no membership</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone can check out. Save a card on file for one-tap buying — it's never charged until you
            actually purchase.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <ShieldCheck className="h-6 w-6 text-brand-red" />
          <h3 className="mt-3 font-heading font-bold text-foreground">Verify to sell &amp; trade</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick ID + selfie check via Stripe unlocks listing, selling and trading on any plan — it
            keeps the marketplace safe for everyone.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <Sparkles className="h-6 w-6 text-brand-red" />
          <h3 className="mt-3 font-heading font-bold text-foreground">Fees only when you sell</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No listing fees and no monthly cost on Hobby. You pay a small fee only when a sale or trade
            goes through.
          </p>
        </div>
      </div>

      {/* Pro highlight */}
      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-brand-blue/30 bg-brand-blue/5 p-6 sm:flex-row sm:items-center">
        <Store className="h-8 w-8 shrink-0 text-brand-blue" />
        <div className="flex-1">
          <h3 className="font-heading text-lg font-bold text-foreground">Why go Pro?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Unlimited listings, your own branded storefront and store URL, a Pro seller badge, advanced
            analytics, premium Vault display styles and priority support — all for ${pro.priceAud}/month
            after your free trial.
          </p>
        </div>
        <Button asChild className="bg-brand-blue font-bold hover:bg-brand-blue/90">
          <Link to={isAuthenticated ? '/account/membership' : '/signup'}>Try Pro free</Link>
        </Button>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Prices in AUD and include applicable taxes. Payments are securely processed by Stripe and PayPal —
        CardPop never sees your card number.
      </p>
    </div>
  );
};

export default PricingPage;
