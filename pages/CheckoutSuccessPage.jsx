import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, Package, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Card } from '@/components/ui/card';

// 'verifying' | 'paid' | 'unpaid' | 'error' | 'missing'
const CheckoutSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { clearCart } = useCart();

  const [sessionData, setSessionData] = useState(null);
  const [status, setStatus] = useState(sessionId ? 'verifying' : 'missing');

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    apiServerClient.fetch(`/stripe/session/${sessionId}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load session: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setSessionData(data);
        const paid = data.status === 'paid' || data.status === 'no_payment_required';
        setStatus(paid ? 'paid' : 'unpaid');
        // Only empty the cart once payment is actually confirmed.
        if (paid) clearCart();
      })
      .catch(err => {
        if (!cancelled) setStatus('error');
      });

    return () => { cancelled = true; };
  }, [sessionId, clearCart]);

  if (status === 'verifying') {
    return (
      <div className="min-h-[80vh] bg-muted/20 py-16 flex flex-col items-center justify-center text-center px-4">
        <Helmet><title>Confirming Order | Card Pop</title></Helmet>
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-6" />
        <h1 className="font-serif text-2xl font-bold mb-2">Confirming your payment…</h1>
        <p className="text-muted-foreground">This will only take a moment.</p>
      </div>
    );
  }

  if (status !== 'paid') {
    const heading = status === 'unpaid'
      ? 'Payment not completed'
      : status === 'missing'
        ? 'No order to show'
        : "We couldn't confirm your payment";
    const message = status === 'unpaid'
      ? 'Your payment was not completed, so your order has not been placed. Your cart has been kept so you can try again.'
      : status === 'missing'
        ? 'There is no checkout session associated with this page.'
        : 'We were unable to verify your payment. If you were charged, please contact support before retrying so you are not charged twice.';

    return (
      <div className="min-h-[80vh] bg-muted/20 py-16 flex items-center justify-center">
        <Helmet><title>Order Status | Card Pop</title></Helmet>
        <div className="max-w-xl w-full px-4 text-center">
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertTriangle className="w-12 h-12 text-amber-600" />
          </div>
          <h1 className="font-serif text-3xl font-bold mb-4">{heading}</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">{message}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/checkout">Return to Checkout</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link to="/browse">Continue Browsing</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-muted/20 py-16 flex items-center justify-center">
      <Helmet><title>Order Confirmed | Card Pop</title></Helmet>

      <div className="max-w-xl w-full px-4 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-in zoom-in duration-500 delay-100">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="font-serif text-4xl font-bold mb-4">Thank you for your order!</h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          Your payment was successful and your order is now being processed. A confirmation email has been sent to you.
        </p>

        <Card className="premium-card p-6 md:p-8 text-left mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="font-bold text-xl mb-6 border-b border-border pb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Order Details
          </h2>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Order Number</span>
              <span className="font-medium font-mono uppercase">#{sessionId.slice(-8)}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {sessionData && (
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold text-primary">${(sessionData.amountTotal / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pb-2">
              <span className="text-muted-foreground">Est. Delivery</span>
              <span className="font-medium text-success">3 - 5 Business Days</span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="rounded-full shadow-lg shadow-primary/20">
            <Link to="/browse">
              Continue Shopping <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link to="/vault">View My Vault</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
