import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Tag, CheckCircle2, XCircle, Undo2, Clock, Loader2, RefreshCw, DollarSign, CreditCard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { offerDisplayStatus } from '@/utils/offerEligibility.js';

// Lazy: only needed once a buyer pays for an accepted offer.
const CheckoutModal = lazy(() => import('@/components/CheckoutModal.jsx'));

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  accepted:  { label: 'Accepted',  className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  declined:  { label: 'Declined',  className: 'bg-destructive/10 text-destructive border-destructive/20' },
  countered: { label: 'Countered', className: 'bg-violet-500/10 text-violet-700 border-violet-500/20' },
  expired:   { label: 'Expired',   className: 'bg-muted text-muted-foreground border-border' },
  withdrawn: { label: 'Withdrawn', className: 'bg-muted text-muted-foreground border-border' },
  paid:      { label: 'Paid',      className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
};

const formatCurrency = (val) => `$${(Number(val) || 0).toFixed(2)}`;
const formatDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

// The expire_stale_offers() sweep flips overdue rows to 'expired' every 15
// minutes, and the offers_enforce_lifecycle trigger already refuses to accept
// or counter one — so derive it here too, and a pending offer (or a seller's
// counter) past its expires_at never shows live Accept/Counter buttons in the
// gap before the sweep runs.
//
// Likewise an accepted offer whose 48-hour payment window (payment_due_at)
// closed unpaid has lapsed; one the webhook stamped paid_at on is done.
const effectiveStatus = (offer) => offerDisplayStatus(offer);

// Button intent → PATCH /offers/:id action. A buyer's "accept"/"decline" is
// always a response to the seller's counter.
const API_ACTION = {
  received: { accepted: 'accept', declined: 'decline' },
  sent: { accepted: 'accept_counter', declined: 'decline_counter', withdrawn: 'withdraw' },
};

const OfferCard = ({ offer, perspective, onAction, actionLoading, onCounter, onPay }) => {
  const isReceived = perspective === 'received';
  const other = isReceived ? offer.buyer : offer.seller;
  const cardName = offer.listing?.vault_item?.card_name || 'Unknown Card';
  const listingPrice = offer.listing?.price_aud;
  const status = effectiveStatus(offer);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isPending = status === 'pending';
  const listingActive = offer.listing?.status === 'active';
  // The agreed price: the seller's counter when one was made, else the
  // buyer's original amount (mirrors resolveOfferPrice on the server).
  const agreedAmount = offer.counter_amount_aud ?? offer.amount_aud;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className={`font-bold text-xs ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(offer.created_at)}</span>
          {offer.expires_at && (isPending || status === 'countered') && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isPending && !isReceived ? 'Binding until ' : 'Expires '}{formatDateTime(offer.expires_at)}
            </span>
          )}
        </div>

        <h3 className="font-bold text-base mb-1 truncate">{cardName}</h3>
        {listingPrice ? (
          <p className="text-xs text-muted-foreground mb-2">Listed at {formatCurrency(listingPrice)}</p>
        ) : (offer.listing?.price_min_aud != null || offer.listing?.price_max_aud != null) && (
          <p className="text-xs text-muted-foreground mb-2">
            Seller seeking {formatCurrency(offer.listing.price_min_aud ?? offer.listing.price_max_aud)}
            {offer.listing.price_max_aud != null && offer.listing.price_min_aud != null
              && ` – ${formatCurrency(offer.listing.price_max_aud)}`}
          </p>
        )}

        <p className="font-extrabold text-xl text-foreground tabular-nums mb-1">
          Offer: {formatCurrency(offer.amount_aud)}
        </p>

        {offer.message && (
          <p className="text-sm text-muted-foreground italic mt-1">"{offer.message}"</p>
        )}

        {isPending && !isReceived && (
          <p className="text-xs text-muted-foreground mt-2">
            You're committed to buy at this price if the seller accepts. Withdraw it before then if you've changed your mind.
          </p>
        )}
        {status === 'accepted' && !isReceived && listingActive && (
          <p className="text-xs text-muted-foreground mt-2">
            Deal agreed at {formatCurrency(agreedAmount)} — you're committed to buy.
            {offer.payment_due_at && (
              <> Please pay by <strong className="text-foreground">{formatDateTime(offer.payment_due_at)}</strong> or the deal lapses.</>
            )}
          </p>
        )}

        {status === 'countered' && offer.counter_amount_aud && (
          <div className="mt-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl">
            <p className="text-xs font-bold text-violet-700 mb-0.5">
              Counter Offer: {formatCurrency(offer.counter_amount_aud)}
            </p>
            {offer.counter_message && (
              <p className="text-xs text-muted-foreground italic">"{offer.counter_message}"</p>
            )}
          </div>
        )}

        {other && (
          <p className="text-xs text-muted-foreground mt-2">
            {isReceived ? 'From' : 'To'}:{' '}
            <span className="font-bold text-foreground">{other.display_name || other.username}</span>
          </p>
        )}
      </div>

      {/* A countered offer is back in the buyer's court — they accept or
          decline the seller's counter from their Sent tab. */}
      {status === 'countered' && !isReceived && (
        <div className="flex sm:flex-col gap-2 shrink-0 self-start sm:self-center">
          {/* Accepting commits the card — only while the listing is live.
              Declining stays available so a dead offer can be closed. */}
          {listingActive && (
            <Button
              size="sm"
              className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
              disabled={!!actionLoading}
              onClick={() => onAction(offer.id, 'accepted', perspective)}
            >
              {actionLoading === `${offer.id}_accept`
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCircle2 className="w-3.5 h-3.5" />}
              Accept Counter
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-bold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
            disabled={!!actionLoading}
            onClick={() => onAction(offer.id, 'declined', perspective)}
          >
            {actionLoading === `${offer.id}_decline`
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <XCircle className="w-3.5 h-3.5" />}
            Decline
          </Button>
        </div>
      )}

      {status === 'countered' && isReceived && (
        <div className="shrink-0 self-start sm:self-center text-xs text-muted-foreground italic">
          Waiting on the buyer's response
        </div>
      )}

      {/* An accepted offer still needs paying — checkout at the agreed price
          completes the deal. Once the listing sells (or is pulled) the button
          goes away because checkout only prices active listings. */}
      {status === 'accepted' && !isReceived && listingActive && (
        <div className="flex sm:flex-col gap-2 shrink-0 self-start sm:self-center">
          <Button
            size="sm"
            className="rounded-xl font-bold gap-1.5"
            onClick={() => onPay(offer)}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Pay {formatCurrency(agreedAmount)}
          </Button>
        </div>
      )}

      {status === 'accepted' && isReceived && listingActive && (
        <div className="shrink-0 self-start sm:self-center text-xs text-muted-foreground italic">
          Waiting on the buyer's payment{offer.payment_due_at ? ` (due ${formatDateTime(offer.payment_due_at)})` : ''}
        </div>
      )}

      {isPending && (
        <div className="flex sm:flex-col gap-2 shrink-0 self-start sm:self-center">
          {isReceived ? (
            <>
              {/* Accept / Counter commit the card — only while the listing is
                  live. Decline stays so the offer can still be closed. */}
              {listingActive && (
                <>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
                    disabled={!!actionLoading}
                    onClick={() => onAction(offer.id, 'accepted', perspective)}
                  >
                    {actionLoading === `${offer.id}_accept`
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold gap-1.5"
                    disabled={!!actionLoading}
                    onClick={() => onCounter(offer)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Counter
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl font-bold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                disabled={!!actionLoading}
                onClick={() => onAction(offer.id, 'declined', perspective)}
              >
                {actionLoading === `${offer.id}_decline`
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <XCircle className="w-3.5 h-3.5" />}
                Decline
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl font-bold gap-1.5"
              disabled={!!actionLoading}
              onClick={() => onAction(offer.id, 'withdrawn', perspective)}
            >
              {actionLoading === `${offer.id}_withdraw`
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Undo2 className="w-3.5 h-3.5" />}
              Withdraw
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ label }) => (
  <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
    <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
    <h3 className="text-xl font-bold mb-2">No {label} offers</h3>
    <p className="text-muted-foreground">
      {label === 'received'
        ? "You haven't received any offers yet."
        : "You haven't sent any offers yet."}
    </p>
  </div>
);

const AccountOffers = () => {
  const { currentUser } = useAuth();
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [counterOffer, setCounterOffer] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [counterSaving, setCounterSaving] = useState(false);
  const [payOffer, setPayOffer] = useState(null);

  const fetchOffers = useCallback(async () => {
    if (!currentUser?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [receivedRes, sentRes] = await Promise.all([
        supabase
          .from('offers')
          .select(`
            *,
            listing:listings(id, status, price_aud, price_min_aud, price_max_aud, listing_type, vault_item:vault_items(card_name, card_image)),
            buyer:profiles!buyer_id(display_name, username, avatar_url, rating, reviews_count)
          `)
          .eq('seller_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select(`
            *,
            listing:listings(id, status, price_aud, price_min_aud, price_max_aud, listing_type, vault_item:vault_items(card_name, card_image)),
            seller:profiles!seller_id(display_name, username, avatar_url, rating, reviews_count)
          `)
          .eq('buyer_id', currentUser.id)
          .order('created_at', { ascending: false }),
      ]);
      if (receivedRes.error) throw receivedRes.error;
      if (sentRes.error) throw sentRes.error;
      setReceived(receivedRes.data || []);
      setSent(sentRes.data || []);
    } catch (err) {
      toast.error('Failed to load offers.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  // Responses go through the backend (not a direct table write) so the other
  // side is emailed; RLS and the lifecycle trigger still enforce every move.
  const respond = async (offerId, body) => {
    const res = await apiServerClient.fetch(`/offers/${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Action failed.');
    return data;
  };

  const handleAction = async (offerId, newStatus, perspective) => {
    const keyMap = { accepted: 'accept', declined: 'decline', withdrawn: 'withdraw' };
    setActionLoading(`${offerId}_${keyMap[newStatus]}`);
    try {
      const action = API_ACTION[perspective]?.[newStatus];
      if (!action) throw new Error('Action failed.');
      await respond(offerId, { action });
      const messages = {
        accept: 'Offer accepted — the buyer has 48 hours to pay.',
        decline: 'Offer declined.',
        accept_counter: 'Counter accepted — please pay within 48 hours.',
        decline_counter: 'Counter declined.',
        withdraw: 'Offer withdrawn.',
      };
      toast.success(messages[action]);
      fetchOffers();
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const openCounter = (offer) => {
    setCounterOffer(offer);
    setCounterAmount('');
    setCounterMessage('');
  };

  const handleCounter = async () => {
    const amt = parseFloat(counterAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid counter amount'); return; }
    setCounterSaving(true);
    try {
      await respond(counterOffer.id, {
        action: 'counter',
        counterAmountAud: amt,
        counterMessage: counterMessage.trim() || null,
      });
      toast.success('Counter offer sent!');
      setCounterOffer(null);
      fetchOffers();
    } catch (err) {
      toast.error(err.message || 'Failed to send counter offer');
    } finally {
      setCounterSaving(false);
    }
  };

  const pendingCount = received.filter(o => effectiveStatus(o) === 'pending').length;

  const renderList = (offers, perspective) => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      );
    }
    if (offers.length === 0) return <EmptyState label={perspective} />;
    return (
      <div className="space-y-4">
        {offers.map(offer => (
          <OfferCard
            key={offer.id}
            offer={offer}
            perspective={perspective}
            onAction={handleAction}
            actionLoading={actionLoading}
            onCounter={openCounter}
            onPay={setPayOffer}
          />
        ))}
      </div>
    );
  };

  return (
    <AccountPageShell
      documentTitle="Offers | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Offers' }]}
      title="Offers"
      description="Manage offers you've sent and received."
    >
      <Tabs defaultValue="received" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="received" className="gap-2">
            Received
            {pendingCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          {renderList(received, 'received')}
        </TabsContent>

        <TabsContent value="sent">
          {renderList(sent, 'sent')}
        </TabsContent>
      </Tabs>
      {/* Counter Offer Dialog */}
      <Dialog open={!!counterOffer} onOpenChange={() => setCounterOffer(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-0 overflow-hidden gap-0">
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" /> Send Counter Offer
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="p-3 bg-muted/50 rounded-xl text-sm">
              <p className="text-muted-foreground text-xs mb-1">Buyer's offer</p>
              <p className="font-extrabold text-lg tabular-nums">{formatCurrency(counterOffer?.amount_aud)}</p>
              {counterOffer?.listing?.price_aud && (
                <p className="text-xs text-muted-foreground mt-0.5">Listed at {formatCurrency(counterOffer.listing.price_aud)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="counter-amount" className="font-bold text-sm">Your Counter Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="counter-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={counterAmount}
                  onChange={e => setCounterAmount(e.target.value)}
                  className="pl-8 h-11 rounded-xl font-bold tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="counter-msg" className="font-bold text-sm">Message <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="counter-msg"
                placeholder="Explain your counter offer..."
                value={counterMessage}
                onChange={e => setCounterMessage(e.target.value)}
                rows={2}
                className="rounded-xl resize-none text-sm"
              />
            </div>
          </div>
          <p className="px-6 pb-4 -mt-1 text-xs text-muted-foreground flex items-start gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0 mt-px" />
            Your counter is binding: the buyer has 48 hours to accept it, and if they do, you've agreed to sell at this price.
          </p>
          <DialogFooter className="px-6 pb-6 gap-2">
            <Button variant="outline" onClick={() => setCounterOffer(null)} disabled={counterSaving} className="rounded-xl flex-1">Cancel</Button>
            <Button onClick={handleCounter} disabled={counterSaving || !counterAmount} className="rounded-xl flex-1 font-bold gap-2">
              {counterSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><RefreshCw className="w-4 h-4" /> Send Counter</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Pay for an accepted offer — checkout carries the offerId so the
          server prices the session from the agreed amount, not the listing. */}
      <Suspense fallback={null}>
        {payOffer && (
          <CheckoutModal
            isOpen
            onClose={() => setPayOffer(null)}
            listingId={payOffer.listing?.id}
            transactionType="offer"
            offerId={payOffer.id}
            cardName={payOffer.listing?.vault_item?.card_name || 'Trading Card'}
          />
        )}
      </Suspense>
    </AccountPageShell>
  );
};

export default AccountOffers;
