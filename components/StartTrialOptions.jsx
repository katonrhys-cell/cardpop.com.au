import React, { useState } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { TRIAL_DAYS, SUBSCRIPTION_PRICE_AUD, PAYMENT_PROVIDERS } from '@/config/subscription.js';

/**
 * Payment-method capture that starts the free trial via Stripe or PayPal.
 *
 * Both providers redirect off-site (Stripe Checkout / PayPal approval) so no
 * card data ever touches CardPop. The card is stored but not charged until the
 * trial ends. `returnPath` is where the provider sends the user back to.
 */
const StartTrialOptions = ({ returnPath = '/account/membership' }) => {
  const [busy, setBusy] = useState(null); // 'stripe' | 'paypal' | null

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const successUrl = `${origin}${returnPath}?trial=started`;
  const cancelUrl = `${origin}${returnPath}?trial=cancelled`;

  const startStripe = async () => {
    setBusy('stripe');
    try {
      const res = await apiServerClient.fetch('/subscription/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successUrl, cancelUrl }),
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
        body: JSON.stringify({ returnUrl: successUrl, cancelUrl }),
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
          {TRIAL_DAYS} days free, then ${SUBSCRIPTION_PRICE_AUD}/month
        </div>
        <p className="mt-1 text-muted-foreground">
          Add a payment method to start selling today. You won't be charged until your trial ends,
          and you can cancel anytime before then.
        </p>
      </div>

      {PAYMENT_PROVIDERS.includes('stripe') && (
        <Button
          onClick={startStripe}
          disabled={busy !== null}
          className="h-12 w-full bg-brand-red font-bold hover:bg-brand-red/90"
        >
          {busy === 'stripe' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
          Start trial with card
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
          Start trial with PayPal
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Secured by Stripe &amp; PayPal. CardPop never sees your card number.
      </p>
    </div>
  );
};

export default StartTrialOptions;
