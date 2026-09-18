import React, { useState } from 'react';
import { Tag, DollarSign, MessageSquare, Clock, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const QUICK_PERCENTAGES = [
  { label: '90%', pct: 0.9 },
  { label: '85%', pct: 0.85 },
  { label: '80%', pct: 0.8 },
];

const MakeOfferModal = ({ isOpen, onClose, listing }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const listingPrice = listing?.price_aud || 0;
  // Expression-of-interest listings have no fixed price — the seller publishes
  // an indicative range instead, and the offer UI anchors on that.
  const rangeMin = listing?.price_min_aud != null ? Number(listing.price_min_aud) : null;
  const rangeMax = listing?.price_max_aud != null ? Number(listing.price_max_aud) : null;
  const isRange = listingPrice <= 0 && (rangeMin != null || rangeMax != null);
  const numericAmount = parseFloat(amount) || 0;
  const savings = listingPrice - numericAmount;
  const savingsPct = listingPrice > 0 ? (savings / listingPrice) * 100 : 0;
  const withinRange = isRange && numericAmount > 0
    && (rangeMin == null || numericAmount >= rangeMin)
    && (rangeMax == null || numericAmount <= rangeMax);

  const handleClose = () => {
    if (submitting) return;
    setAmount('');
    setMessage('');
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!isAuthenticated || !currentUser?.id) {
      toast.error('Please log in to make an offer');
      navigate('/login');
      return;
    }
    if (currentUser.id === listing?.seller_id) {
      toast.error("You can't make an offer on your own listing");
      return;
    }
    if (numericAmount <= 0) {
      toast.error('Please enter a valid offer amount');
      return;
    }
    const sanityCap = isRange ? (rangeMax ?? rangeMin) : listingPrice;
    if (sanityCap > 0 && numericAmount > sanityCap * 1.5) {
      toast.error('Offer amount seems unusually high');
      return;
    }

    setSubmitting(true);
    try {
      // Posted through the backend rather than inserted straight into `offers`:
      // the row is still written as this user (RLS unchanged), but the server
      // is where the seller's notification email is sent from. The in-app
      // notification comes from the on_offer_created database trigger either
      // way, so the bell fills even if the email can't be delivered.
      const res = await apiServerClient.fetch('/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          sellerId: listing.seller_id,
          amountAud: numericAmount,
          message: message.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit offer. Please try again.');
      }
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to submit offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden gap-0">
        {submitted ? (
          <div className="flex flex-col items-center text-center p-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Offer Sent!</h2>
              <p className="text-muted-foreground text-sm">
                Your offer of <span className="font-bold text-foreground">${numericAmount.toFixed(2)}</span> has been sent to the seller.
                You'll be notified when they respond.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 px-3 py-2 rounded-lg">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Expires in 48 hours if not accepted
            </div>
            <div className="flex gap-3 w-full mt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose}>Close</Button>
              <Button className="flex-1 rounded-xl" onClick={() => { handleClose(); navigate('/account/offers'); }}>
                View My Offers
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Tag className="w-5 h-5 text-primary" /> Make an Offer
                </DialogTitle>
                <DialogDescription className="text-sm truncate mt-1">
                  {listing?.vault_item?.card_name || listing?.title || 'Listing'}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Price context */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                    {isRange ? "Seller Is Looking For" : 'Asking Price'}
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums">
                    {isRange
                      ? `$${(rangeMin ?? rangeMax).toFixed(2)}${rangeMax != null && rangeMin != null ? ` – $${rangeMax.toFixed(2)}` : ''}`
                      : `$${listingPrice.toFixed(2)}`}
                  </p>
                </div>
                {numericAmount > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Your Offer</p>
                    <p className={`text-2xl font-extrabold tabular-nums ${!isRange && numericAmount < listingPrice ? 'text-primary' : 'text-foreground'}`}>
                      ${numericAmount.toFixed(2)}
                    </p>
                    {isRange ? (
                      withinRange ? (
                        <p className="text-xs text-emerald-600 font-bold">Within the seller's range</p>
                      ) : (
                        <p className="text-xs text-amber-600 font-bold">
                          {rangeMin != null && numericAmount < rangeMin ? "Below the seller's range" : "Above the seller's range"}
                        </p>
                      )
                    ) : savings > 0 && (
                      <p className="text-xs text-emerald-600 font-bold">Save ${savings.toFixed(2)} ({savingsPct.toFixed(0)}% off)</p>
                    )}
                  </div>
                )}
              </div>

              {/* Quick picks */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Quick select</p>
                <div className="grid grid-cols-3 gap-2">
                  {(isRange
                    ? [
                        { label: 'Low End', value: rangeMin ?? rangeMax },
                        { label: 'Middle', value: ((rangeMin ?? rangeMax) + (rangeMax ?? rangeMin)) / 2 },
                        { label: 'Top End', value: rangeMax ?? rangeMin },
                      ]
                    : QUICK_PERCENTAGES.map(({ label, pct }) => ({ label, value: listingPrice * pct }))
                  ).map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAmount(value.toFixed(2))}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                        amount === value.toFixed(2)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50 hover:bg-muted/60'
                      }`}
                    >
                      <span className="block">{label}</span>
                      <span className="block text-[11px] font-normal opacity-70">${value.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div className="space-y-1.5">
                <Label htmlFor="offer-amount" className="text-sm font-bold">Your Offer Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="offer-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pl-8 h-11 rounded-xl font-bold text-base tabular-nums"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="offer-message" className="text-sm font-bold flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Message <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="offer-message"
                  placeholder="Add a note to the seller..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="rounded-xl resize-none text-sm"
                />
              </div>

              {/* Expiry notice */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-2.5 rounded-xl">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Offers expire in 48 hours. Seller will accept, decline, or counter.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl gap-2 font-bold"
                onClick={handleSubmit}
                disabled={submitting || numericAmount <= 0}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <>Send Offer <ChevronRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MakeOfferModal;
