import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import RefundPolicyNote from '@/components/RefundPolicyNote.jsx';

const LineRow = ({ label, value, bold, highlight }) => (
  <div className={`flex justify-between items-center text-sm ${bold ? 'font-bold text-base' : ''} ${highlight ? 'text-primary' : ''}`}>
    <span className={bold ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    <span className={bold ? 'text-foreground' : 'text-foreground'}>{value}</span>
  </div>
);

/**
 * CheckoutModal — shows a server-calculated cost breakdown then redirects to Stripe.
 *
 * Props:
 *   isOpen         boolean
 *   onClose        () => void
 *   listingId      string
 *   transactionType  'fixed' | 'offer' | 'auction'   default 'fixed'
 *   offerId        string | null   (for offer-based checkouts)
 *   cardName       string          (display only)
 */
const CheckoutModal = ({ isOpen, onClose, listingId, transactionType = 'fixed', offerId = null, cardName = 'Trading Card' }) => {
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !listingId) return;
    let cancelled = false;

    const fetchBreakdown = async () => {
      setLoadingBreakdown(true);
      setError(null);
      try {
        const params = new URLSearchParams({ listingId, transactionType });
        const res = await apiClient.get(`/stripe/calculate?${params}`);
        if (!cancelled) setBreakdown(res.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load price breakdown.');
      } finally {
        if (!cancelled) setLoadingBreakdown(false);
      }
    };

    fetchBreakdown();
    return () => { cancelled = true; };
  }, [isOpen, listingId, transactionType]);

  const handleConfirmPay = async () => {
    if (!breakdown) return;
    setLoadingCheckout(true);
    try {
      const successUrl = `${window.location.origin}/account/orders?success=1`;
      const cancelUrl  = window.location.href;

      const payload = { listingId, transactionType, successUrl, cancelUrl };
      if (offerId) payload.offerId = offerId;

      const res = await apiClient.post('/stripe/create-checkout', payload);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start checkout. Please try again.');
      setLoadingCheckout(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold">Order Summary</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review your purchase before proceeding to payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Card name */}
          <div className="bg-muted/40 rounded-2xl p-4 text-sm font-medium text-foreground truncate">
            {cardName}
          </div>

          {/* Breakdown */}
          {loadingBreakdown ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-full rounded-md" />)}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : breakdown ? (
            <div className="space-y-3">
              <LineRow label="Item Price" value={`$${breakdown.itemPrice.toFixed(2)} AUD`} />
              {breakdown.commissionAud > 0 && (
                <LineRow
                  label={`Platform Fee (${breakdown.commissionPct}%)`}
                  value={`$${breakdown.commissionAud.toFixed(2)} AUD`}
                />
              )}
              {breakdown.gstAud > 0 && (
                <LineRow label="GST" value={`$${breakdown.gstAud.toFixed(2)} AUD`} />
              )}
              <Separator />
              <LineRow label="Total" value={`$${breakdown.total.toFixed(2)} AUD`} bold />
            </div>
          ) : null}

          {/* Trust note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
            <span>Secured by Stripe. CardPop Buyer Protection applies to this transaction.</span>
          </div>

          {/* Refund policy disclosure */}
          {breakdown && (
            <RefundPolicyNote
              variant="full"
              itemPrice={breakdown.itemPrice}
              commissionAud={breakdown.commissionAud}
            />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-bold" disabled={loadingCheckout}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPay}
            disabled={!breakdown || loadingBreakdown || loadingCheckout}
            className="flex-1 rounded-xl font-bold h-12"
          >
            {loadingCheckout ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Pay ${breakdown?.total?.toFixed(2) ?? '...'}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
