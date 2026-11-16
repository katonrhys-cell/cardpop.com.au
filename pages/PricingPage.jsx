import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, CreditCard, Sparkles, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { PLANS, PLAN_ORDER, PLAN_HOBBY, PLAN_PRO, planKeyFromTier } from '@/config/plans.js';

// Public pricing page: Hobby (free, always), Pro ($99 a year — vendors and
// avid traders) and Ultimate ($199 a year — show organisers and card shop owners). Anyone can
// browse and buy; listing, selling and trading unlock after a quick Stripe
// Identity check on every plan. Both paid plans are charged yearly at
// sign-up, with no trial, and the price is the whole price (GST included).

const PlanCard = ({ plan, highlighted, cta }) => (
  <div
    className={`relative flex flex-col rounded-2xl border p-6 ${
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
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">{plan.audience}</p>
    <h2 className="mt-1 font-heading text-xl font-bold text-foreground">{plan.name}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
    <div className="mt-5 flex items-end gap-1">
      {plan.priceAud > 0 ? (
        <>
          <span className="font-heading text-3xl font-extrabold text-foreground">${plan.priceAud}</span>
          <span className="mb-1 text-sm text-muted-foreground">/{plan.interval} AUD</span>
        </>
      ) : (
        <span className="font-heading text-3xl font-extrabold text-foreground">Free</span>
      )}
    </div>
    {plan.priceAud > 0 ? (
      <p className="mt-1 text-xs text-muted-foreground">
        {plan.trialDays
          ? `${plan.trialDays}-day free trial, then billed yearly — cancel anytime`
          : 'One payment a year, GST included — nothing added at checkout'}
      </p>
    ) : (
      <p className="mt-1 text-xs text-muted-foreground">No card required to start</p>
    )}

    <ul className="mt-6 flex-1 space-y-2.5">
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
  const { isAuthenticated, isPro, subscriptionTier } = useAuth();
  const currentPlanKey = isPro ? planKeyFromTier(subscriptionTier) : PLAN_HOBBY;

  const paidCta = (plan) => {
    const isCurrent = currentPlanKey === plan.key;
    const label = isCurrent
      ? `Manage ${plan.name}`
      : isAuthenticated
        ? `Join ${plan.name} — $${plan.priceAud}/${plan.interval}`
        : `Get started with ${plan.name}`;
    const to = isAuthenticated ? `/account/membership?tier=${plan.key}` : '/signup';
    return (
      <Button asChild className="h-11 w-full bg-brand-red font-bold hover:bg-brand-red/90">
        <Link to={to}>{label}</Link>
      </Button>
    );
  };

  return (
    <div className="container-default py-12">
      <Helmet>
        <title>Pricing — Hobby, Pro &amp; Ultimate | CardPop</title>
        <meta
          name="description"
          content="CardPop is free to join, and always will be. Pro is $99 a year for vendors and avid traders; Ultimate is $199 a year for show organisers and card shop owners who want every event featured."
        />
      </Helmet>

      <div className="text-center">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">Simple, fair pricing</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Joining CardPop is free, and always will be. Browse and buy right away. To list, sell or
          trade, just verify your identity — then you only pay a small fee when a sale or trade
          completes. Pro is one yearly payment for vendors and avid traders; Ultimate is for show
          organisers who want every event they run featured on the calendar.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          if (key === PLAN_HOBBY) {
            return (
              <PlanCard
                key={key}
                plan={plan}
                highlighted={false}
                cta={
                  <Button asChild variant="outline" className="h-11 w-full border-2 font-bold">
                    <Link to={isAuthenticated ? '/account' : '/signup'}>
                      {isAuthenticated ? 'Your account' : 'Create free account'}
                    </Link>
                  </Button>
                }
              />
            );
          }
          return (
            <PlanCard key={key} plan={plan} highlighted={key === PLAN_PRO} cta={paidCta(plan)} />
          );
        })}
      </div>

      {/* How it works */}
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <CreditCard className="h-6 w-6 text-brand-red" />
          <h3 className="mt-3 font-heading font-bold text-foreground">Buy with no membership</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone can check out. A card on file gives one-tap buying and is required to sell or trade —
            it's never charged until you actually transact.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <ShieldCheck className="h-6 w-6 text-brand-red" />
          <h3 className="mt-3 font-heading font-bold text-foreground">Verify to sell &amp; trade</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            To list, sell or trade on any plan, verify your ID (a quick selfie + document check via
            Stripe) and keep a card on file. It keeps the marketplace safe and fees fair.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <Sparkles className="h-6 w-6 text-brand-red" />
          <h3 className="mt-3 font-heading font-bold text-foreground">Fees only when you sell</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No listing fees and no membership cost on Hobby. Every plan pays the same small fee only
            when a sale or trade goes through — a membership buys features, not lower fees.
          </p>
        </div>
      </div>

      {/* Paid-tier highlight */}
      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-center">
        <Store className="h-8 w-8 shrink-0 text-brand-red" />
        <div className="flex-1">
          <h3 className="font-heading text-lg font-bold text-foreground">Why upgrade?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pro gives vendors and avid traders their own store page on the Local Traders directory,
            30 listings a month, Whatnot show listings and the Pro display styles. Ultimate adds
            unlimited listings, every display style and Calendar Spotlight on every show you run.
          </p>
        </div>
        <Button asChild className="bg-brand-red font-bold hover:bg-brand-red/90">
          <Link to={isAuthenticated ? '/account/membership' : '/signup'}>Become a member</Link>
        </Button>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Prices are in AUD and include GST. Memberships are charged once a year at sign-up and renew
        each year until you cancel — we email you before each renewal. Payments are securely
        processed by Stripe; CardPop never sees your card number.
      </p>
    </div>
  );
};

export default PricingPage;
