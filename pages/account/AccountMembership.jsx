import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import StartTrialOptions from '@/components/StartTrialOptions.jsx';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Loader2, Sparkles } from 'lucide-react';
import { TRIAL_DAYS } from '@/config/subscription.js';

const STATUS_LABEL = {
  trialing:      { label: 'Free trial active', tone: 'text-brand-red', Icon: Sparkles },
  active:        { label: 'Membership active', tone: 'text-green-600', Icon: BadgeCheck },
  grandfathered: { label: 'Membership active', tone: 'text-green-600', Icon: BadgeCheck },
  past_due:      { label: 'Payment overdue',   tone: 'text-yellow-600', Icon: Clock },
  canceled:      { label: 'Membership cancelled', tone: 'text-muted-foreground', Icon: Clock },
  none:          { label: 'No active membership', tone: 'text-muted-foreground', Icon: Clock },
};

const AccountMembership = () => {
  const { canSell, subscriptionStatus, trialDaysLeft, refetchProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [activating, setActivating] = useState(false);

  // Handle returns from Stripe / PayPal.
  useEffect(() => {
    const paypalSubId = params.get('subscription_id');
    const trial = params.get('trial');

    const finish = async () => {
      if (paypalSubId) {
        setActivating(true);
        try {
          const res = await apiServerClient.fetch('/subscription/paypal/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: paypalSubId }),
          });
          if (res.ok) toast.success('Your free trial is active. Welcome aboard!');
          else toast.error('We could not confirm your PayPal subscription. Please contact support.');
        } catch {
          toast.error('We could not confirm your PayPal subscription.');
        } finally {
          setActivating(false);
        }
      } else if (trial === 'started') {
        toast.success('Your free trial is active. Welcome aboard!');
      } else if (trial === 'cancelled') {
        toast('Checkout cancelled — you can start your trial anytime.');
      }

      if (paypalSubId || trial) {
        await refetchProfile?.();
        // Clear the query params so a refresh doesn't re-trigger.
        setParams({}, { replace: true });
      }
    };

    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = STATUS_LABEL[subscriptionStatus] || STATUS_LABEL.none;
  const { Icon } = meta;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Helmet><title>Membership | CardPop</title></Helmet>

      <h1 className="font-heading text-2xl font-bold text-foreground">Membership</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your CardPop membership lets you list and sell cards. Browsing and buying are always free.
      </p>

      <div className="mt-6 rounded-card border border-border bg-card p-6">
        <div className={`flex items-center gap-2 font-bold ${meta.tone}`}>
          <Icon className="h-5 w-5" />
          {activating ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</> : meta.label}
        </div>
        {subscriptionStatus === 'trialing' && trialDaysLeft != null && (
          <p className="mt-2 text-sm text-muted-foreground">
            {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left on your free trial.
          </p>
        )}
      </div>

      {!canSell && (
        <div className="mt-8">
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
            Start your {TRIAL_DAYS}-day free trial
          </h2>
          <StartTrialOptions returnPath="/account/membership" />
        </div>
      )}
    </div>
  );
};

export default AccountMembership;
