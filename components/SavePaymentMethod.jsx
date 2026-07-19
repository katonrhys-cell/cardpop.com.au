import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

/**
 * "Save a card on file" — Hobby (and Pro) buyers can store a payment method so
 * checkout is one tap. The card is NEVER charged until they actually buy: this
 * uses a Stripe Checkout Session in `setup` mode (POST /wallet/save-card), which
 * only attaches the method to their Stripe Customer. Existing saved cards are
 * read back from /wallet/payment-methods (brand / last4 / expiry only).
 */
const BRAND_LABEL = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express',
  discover: 'Discover', jcb: 'JCB', diners: 'Diners Club', unionpay: 'UnionPay',
};

const SavePaymentMethod = () => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/wallet/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setMethods(data.paymentMethods || []);
      }
    } catch {
      // Non-fatal — the "add a card" action still works.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
    // Returning from the Stripe setup flow — refresh the saved list.
    const params = new URLSearchParams(window.location.search);
    if (params.get('savedCard') === 'success') {
      toast.success('Card saved — you can now check out in one tap.');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(fetchMethods, 1200);
    }
  }, [fetchMethods]);

  const handleAddCard = async () => {
    setStarting(true);
    try {
      const origin = window.location.origin;
      const returnPath = '/account/wallet';
      const res = await apiServerClient.fetch('/wallet/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successUrl: `${origin}${returnPath}?savedCard=success`,
          cancelUrl: `${origin}${returnPath}?savedCard=cancelled`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start card setup');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || 'Could not start card setup');
      setStarting(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <CreditCard className="h-4 w-4 text-brand-red" /> Saved payment methods
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Save a card for one-tap checkout. It's stored securely by Stripe and{' '}
          <span className="font-semibold text-foreground">never charged until you actually buy something</span>.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : methods.length > 0 ? (
          <ul className="space-y-2">
            {methods.map((pm) => (
              <li
                key={pm.id}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {BRAND_LABEL[pm.brand] || 'Card'} •••• {pm.last4}
                </span>
                {pm.expMonth && pm.expYear && (
                  <span className="text-xs text-muted-foreground">
                    Expires {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(-2)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            No cards saved yet.
          </div>
        )}

        <Button onClick={handleAddCard} disabled={starting} variant="outline" className="h-11 w-full font-bold">
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          {methods.length > 0 ? 'Add another card' : 'Save a card'}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Secured by Stripe. CardPop never sees your card number.
        </p>
      </CardContent>
    </Card>
  );
};

export default SavePaymentMethod;
