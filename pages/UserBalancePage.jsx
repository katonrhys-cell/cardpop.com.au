import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Wallet, PlusCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const PRESET_AMOUNTS = [20, 50, 100];

const UserBalancePage = () => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingBalance(true);
    try {
      const res = await apiServerClient.fetch('/wallet/balance');
      if (res.ok) {
        const data = await res.json();
        setBalance(Number(data.balanceAud) || 0);
      }
    } catch {
      toast.error('Could not load your wallet balance.');
    } finally {
      setLoadingBalance(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchBalance();

    const params = new URLSearchParams(window.location.search);
    if (params.get('topup') === 'success') {
      toast.success('Funds added! Your balance updates once payment is confirmed.');
      setTimeout(fetchBalance, 1500);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchBalance]);

  const handleTopup = async () => {
    const amountAud = Number(amount);
    if (!Number.isFinite(amountAud) || amountAud < 5 || amountAud > 500) {
      toast.error('Enter an amount between $5 and $500.');
      return;
    }
    setSubmitting(true);
    try {
      const successUrl = `${window.location.origin}/balance?topup=success`;
      const cancelUrl = `${window.location.origin}/balance`;
      const res = await apiServerClient.fetch('/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountAud, successUrl, cancelUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start top-up.');
      if (!data?.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || 'Could not start top-up.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet><title>My Wallet | Card Pop</title></Helmet>

      <div className="flex-1 container-default py-12 w-full">
        <h1 className="font-serif text-4xl font-bold mb-8 text-center">Wallet & Balance</h1>

        <div className="premium-card p-10 bg-card text-center mb-8 bg-gradient-to-br from-card to-muted/50">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2">Available Balance</p>
          {loadingBalance ? (
            <Skeleton className="h-14 w-40 mx-auto mb-8" />
          ) : (
            <h2 className="text-6xl font-bold tabular-nums text-foreground mb-8">${balance.toFixed(2)}</h2>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="h-12 px-8 rounded-full font-bold shadow-sm" onClick={() => setDialogOpen(true)}>
              <PlusCircle className="w-5 h-5 mr-2" /> Add Funds
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="premium-card p-6 bg-card">
            <h3 className="font-bold text-lg mb-4">How your wallet works</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">• <span>Add funds any time via a secure Stripe card payment.</span></li>
              <li className="flex items-start gap-2">• <span>Your balance is applied automatically at checkout — look for the wallet option before you pay.</span></li>
              <li className="flex items-start gap-2">• <span>Balances are managed entirely by Stripe, not held by CardPop.</span></li>
            </ul>
          </div>
          <div className="premium-card p-6 bg-card border border-primary/20 bg-primary/5">
            <h3 className="font-bold text-lg mb-2 text-primary flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Secured by Stripe
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Top-ups are processed by Stripe using the same secure checkout as your orders. CardPop never stores your card details.</p>
            <Button variant="outline" className="w-full bg-background">Contact Support</Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!submitting) setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold">Add Funds</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Choose an amount to add to your CardPop wallet via Stripe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={Number(amount) === preset ? 'default' : 'outline'}
                  className="flex-1 rounded-xl font-bold"
                  onClick={() => setAmount(String(preset))}
                >
                  ${preset}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={5}
              max={500}
              step="0.01"
              placeholder="Custom amount (AUD)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-center font-bold"
            />
            <p className="text-xs text-muted-foreground text-center">Min $5, max $500 AUD per top-up.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 rounded-xl font-bold" disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleTopup} disabled={submitting || !amount} className="flex-1 rounded-xl font-bold">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</> : 'Continue to Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserBalancePage;
