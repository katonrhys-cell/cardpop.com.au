import React, { useState } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { TRIAL_DAYS, TIER_PRICES_AUD, PAYMENT_PROVIDERS, normalizePaidTier } from '@/config/subscription.js';
import { PLANS } from '@/config/plans.js';
import { getReferralCode } from '@/lib/referral.js';
import StripeWordmark from '@/components/StripeWordmark.jsx';

/**
 * The "Join" step of a CardPop membership. `tier` picks which paid plan is
 * bought ('pro' | 'ultimate'); the server bills the matching yearly Stripe
 * price. (The component keeps its name from the trial era.)
 *
 * The provider redirects off-site (Stripe Checkout) so no card data ever
 * touches CardPop. With TRIAL_DAYS = 0 the year is charged at checkout; a
 * non-zero TRIAL_DAYS brings the "free, then charged" copy back.
 * `returnPath` is where the provider sends the user back to.
 */
const StartTrialOptions = ({ returnPath = '/account/membership', tier = 'pro' }) => {
  const [busy, setBusy] = useState(null); // 'stripe' | 'paypal' | null

  const paidTier = normalizePaidTier(tier);
  const tierName = PLANS[paidTier]?.name || 'Pro';
  const priceAud = TIER_PRICES_AUD[paidTier];

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const successUrl = `${origin}${returnPath}?trial=started`;
  const cancelUrl = `${origin}${returnPath}?trial=cancelled`;

  const startStripe = async () => {
    setBusy('stripe');
    try {
      const res = await apiServerClient.fetch('/subscription/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A partner ?ref=CODE captured this session attributes the referral;
        // the server validates it and simply ignores an invalid code.
        body: JSON.stringify({ successUrl, cancelUrl, tier: paidTier, ...(getReferralCode() ? { refCode: getReferralCode() } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || 'Could not start Stripe checkout');
      setBusy(null);
    }
  };

  const startPaypal = async () => {
    setBusy('paypal');
    try {
      const res = await apiServerClient.fetch('/subscription/paypal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: successUrl, cancelUrl, tier: paidTier }),
      });
      const data = await res.json();
      if (!res.ok || !data.approveUrl) throw new Error(data.error || 'Could not start PayPal');
      window.location.href = data.approveUrl;
    } catch (err) {
      toast.error(err.message || 'Could not start PayPal checkout');
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-muted/30 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <ShieldCheck className="h-4 w-4 text-brand-red" />
          {TRIAL_DAYS > 0 ? `${TRIAL_DAYS} days free, then $${priceAud} a year` : `$${priceAud} a year, GST included`}
        </div>
        <p className="mt-1 text-muted-foreground">
          {TRIAL_DAYS > 0
            ? `Add a payment method to unlock CardPop ${tierName}. You won't be charged until your trial ends, and you can cancel anytime before then from Account → Membership.`
            : `You pay $${priceAud} today for 12 months of CardPop ${tierName} — that is the whole price, nothing is added at checkout. It renews each year until you cancel from Account → Membership, and we email you a week before every renewal.`}
        </p>
      </div>

      {PAYMENT_PROVIDERS.includes('stripe') && (
        <Button
          onClick={startStripe}
          disabled={busy !== null}
          className="h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90"
        >
          {busy === 'stripe' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
          {TRIAL_DAYS > 0 ? `Start ${tierName} trial with card` : `Join ${tierName} — $${priceAud}`}
        </Button>
      )}

      {PAYMENT_PROVIDERS.includes('paypal') && (
        <Button
          onClick={startPaypal}
          disabled={busy !== null}
          variant="outline"
          className="h-12 w-full border-2 font-bold"
        >
          {busy === 'paypal'
            ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            : <span className="mr-1 font-heading font-extrabold"><span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span></span>}
          {TRIAL_DAYS > 0 ? 'Start trial with PayPal' : `Join ${tierName} with PayPal`}
        </Button>
      )}

      <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-muted-foreground">
        <span>Secured by</span>
        <StripeWordmark className="h-4 w-auto text-[#635BFF]" />
        {PAYMENT_PROVIDERS.includes('paypal') && <span>&amp; PayPal</span>}
        <span className="ml-1">CardPop never sees your card number.</span>
      </p>
    </div>
  );
};

export default StartTrialOptions;
