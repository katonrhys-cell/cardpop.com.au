import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Tag, CheckCircle2, XCircle, Undo2, Clock, Loader2, RefreshCw, DollarSign, CreditCard,
  Inbox, Send, Search, ExternalLink, MessageSquareQuote,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { slugify } from '@/lib/slugify.js';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import { offerDisplayStatus, formatOfferRange } from '@/utils/offerEligibility.js';

// Lazy: only needed once a buyer pays for an accepted offer.
const CheckoutModal = lazy(() => import('@/components/CheckoutModal.jsx'));

// Same status-chip palette as the Watchlist / Orders rows (tinted fill, dark
// variant on the text) so the account section reads as one system.
const STATUS_CONFIG = {
  pending:   { label: 'Pending',   className: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400' },
  accepted:  { label: 'Accepted',  className: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' },
  declined:  { label: 'Declined',  className: 'bg-destructive/10 text-destructive border-destructive/20' },
  countered: { label: 'Countered', className: 'bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-400' },
  expired:   { label: 'Expired',   className: 'bg-muted text-muted-foreground border-border' },
  withdrawn: { label: 'Withdrawn', className: 'bg-muted text-muted-foreground border-border' },
  paid:      { label: 'Paid',      className: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' },
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

// An accepted offer the buyer still has to pay for — checkout only prices
// active listings, so once the card sells (or is pulled) it drops out.
const awaitingPayment = (offer) =>
  effectiveStatus(offer) === 'accepted' && offer.listing?.status === 'active';

const ACTION_BTN = 'rounded-xl font-bold gap-1.5 h-9';
const ACCEPT_BTN = `${ACTION_BTN} bg-emerald-500 hover:bg-emerald-600 text-white`;
const DECLINE_BTN = `${ACTION_BTN} text-destructive border-destructive/30 hover:bg-destructive/10`;

const Spinner = () => <Loader2 className="w-3.5 h-3.5 animate-spin" />;

// ── Summary tile (the dashboard's stat card) ──────────────────────────────────
const StatTile = ({ title, value, hint, icon: Icon, tint, loading }) => (
  <Card className="shadow-sm border-border hover:border-primary/30 transition-colors bg-card h-full flex flex-col">
    <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-1 sm:p-6 sm:pb-2">
      <CardTitle className="text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider leading-snug">{title}</CardTitle>
      <Icon className={`w-4 h-4 shrink-0 ${tint}`} />
    </CardHeader>
    <CardContent className="flex-1 flex flex-col justify-end p-4 pt-0 sm:p-6 sm:pt-0">
      {loading ? <Skeleton className="h-8 w-12" /> : (
        <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</div>
      )}
      {/* The hint is desktop-only — three tiles share a phone's width. */}
      <p className="hidden sm:block text-xs text-muted-foreground mt-2">{hint}</p>
    </CardContent>
  </Card>
);

// A link when the listing still resolves, a plain box otherwise. Module-level
// so the row's re-renders don't remount the thumbnail.
const MaybeLink = ({ to, className, children }) =>
  to ? <Link to={to} className={className}>{children}</Link> : <div className={className}>{children}</div>;

// ── Single offer row ──────────────────────────────────────────────────────────
const OfferCard = ({ offer, perspective, onAction, actionLoading, onCounter, onPay }) => {
  const isReceived = perspective === 'received';
  const other = isReceived ? offer.buyer : offer.seller;
  const vi = offer.listing?.vault_item;
  const cardName = vi?.card_name || 'Unknown Card';
  const listingPrice = offer.listing?.price_aud;
  const status = effectiveStatus(offer);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isPending = status === 'pending';
  const listingActive = offer.listing?.status === 'active';
  // The agreed price: the seller's counter when one was made, else the
  // buyer's original amount (mirrors resolveOfferPrice on the server).
  const agreedAmount = offer.counter_amount_aud ?? offer.amount_aud;
  const busy = !!actionLoading;
  const loadingKey = (k) => actionLoading === `${offer.id}_${k}`;

  // 64 px row thumbnail: the 480 px companion, never the full upload.
  const imgSrc = cardThumbUrl(vi?.card_image || null);
  const detailPath = offer.listing?.id ? `/marketplace/${offer.listing.id}/${slugify(cardName)}` : null;
  const otherName = other?.display_name || other?.username;
  const otherPath = other?.id ? `/community/user/${other.id}` : null;

  const showsDeadline = offer.expires_at && (isPending || status === 'countered');
  const deadlineLabel = isPending && !isReceived ? 'Binding until' : 'Expires';

  // ── Right-hand column: the buttons (or the waiting note) for this state ──
  let actions = null;
  if (isPending && isReceived) {
    actions = (
      <>
        {/* Accept / Counter commit the card — only while the listing is live.
            Decline stays so the offer can still be closed. */}
        {listingActive && (
          <>
            <Button size="sm" className={ACCEPT_BTN} disabled={busy} onClick={() => onAction(offer.id, 'accepted', perspective)}>
              {loadingKey('accept') ? <Spinner /> : <CheckCircle2 className="w-3.5 h-3.5" />} Accept
            </Button>
            <Button size="sm" variant="outline" className={ACTION_BTN} disabled={busy} onClick={() => onCounter(offer)}>
              <RefreshCw className="w-3.5 h-3.5" /> Counter
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" className={DECLINE_BTN} disabled={busy} onClick={() => onAction(offer.id, 'declined', perspective)}>
          {loadingKey('decline') ? <Spinner /> : <XCircle className="w-3.5 h-3.5" />} Decline
        </Button>
      </>
    );
  } else if (isPending && !isReceived) {
    actions = (
      <Button size="sm" variant="outline" className={ACTION_BTN} disabled={busy} onClick={() => onAction(offer.id, 'withdrawn', perspective)}>
        {loadingKey('withdraw') ? <Spinner /> : <Undo2 className="w-3.5 h-3.5" />} Withdraw
      </Button>
    );
  } else if (status === 'countered' && !isReceived) {
    // A countered offer is back in the buyer's court — they accept or decline
    // the seller's counter from their Sent tab. Accepting commits the card, so
    // only while the listing is live; declining can always close a dead offer.
    actions = (
      <>
        {listingActive && (
          <Button size="sm" className={ACCEPT_BTN} disabled={busy} onClick={() => onAction(offer.id, 'accepted', perspective)}>
            {loadingKey('accept') ? <Spinner /> : <CheckCircle2 className="w-3.5 h-3.5" />} Accept Counter
          </Button>
        )}
        <Button size="sm" variant="outline" className={DECLINE_BTN} disabled={busy} onClick={() => onAction(offer.id, 'declined', perspective)}>
          {loadingKey('decline') ? <Spinner /> : <XCircle className="w-3.5 h-3.5" />} Decline
        </Button>
      </>
    );
  } else if (status === 'countered' && isReceived) {
    actions = <p className="text-xs text-muted-foreground italic sm:text-right">Waiting on the buyer's response</p>;
  } else if (status === 'accepted' && !isReceived && listingActive) {
    // Checkout at the agreed price completes the deal.
    actions = (
      <Button size="sm" className={ACTION_BTN} onClick={() => onPay(offer)}>
        <CreditCard className="w-3.5 h-3.5" /> Pay {formatCurrency(agreedAmount)}
      </Button>
    );
  } else if (status === 'accepted' && isReceived && listingActive) {
    actions = (
      <p className="text-xs text-muted-foreground italic sm:text-right">
        Waiting on the buyer's payment{offer.payment_due_at ? ` (due ${formatDateTime(offer.payment_due_at)})` : ''}
      </p>
    );
  }

  return (
    <div className="group flex flex-col sm:flex-row gap-4 p-4 sm:p-5 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-200">
      <div className="flex gap-4 flex-1 min-w-0">
        {/* Card image */}
        <MaybeLink to={detailPath} className="shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-muted/30 block">
          {imgSrc ? (
            <img src={imgSrc} alt={cardName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tag className="w-5 h-5 text-muted-foreground opacity-30" />
            </div>
          )}
        </MaybeLink>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <MaybeLink to={detailPath} className="min-w-0">
              <h3 className="font-bold text-sm leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {cardName}
              </h3>
            </MaybeLink>
            <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mb-1.5 truncate">
            {listingPrice
              ? `Listed at ${formatCurrency(listingPrice)}`
              : (offer.listing?.price_min_aud != null || offer.listing?.price_max_aud != null)
                ? `Seller's range: ${formatOfferRange(offer.listing.price_min_aud, offer.listing.price_max_aud)}`
                : 'Expression of interest'}
            {' · '}{formatDate(offer.created_at)}
          </p>

          {/* Money row: the offer, the counter if any, and the clock */}
          <div className="flex items-end gap-x-5 gap-y-2 mt-1.5 flex-wrap">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {isReceived ? 'Their offer' : 'Your offer'}
              </p>
              <p className="font-extrabold text-base tabular-nums text-foreground">{formatCurrency(offer.amount_aud)}</p>
            </div>
            {status === 'countered' && offer.counter_amount_aud && (
              <div>
                <p className="text-[10px] text-violet-700 dark:text-violet-400 font-medium uppercase tracking-wide">
                  {isReceived ? 'Your counter' : "Seller's counter"}
                </p>
                <p className="font-extrabold text-base tabular-nums text-violet-700 dark:text-violet-400">
                  {formatCurrency(offer.counter_amount_aud)}
                </p>
              </div>
            )}
            {status === 'accepted' && (
              <div>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide">Agreed price</p>
                <p className="font-extrabold text-base tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(agreedAmount)}</p>
              </div>
            )}
            {showsDeadline && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="text-xs font-bold tabular-nums">{deadlineLabel} {formatDateTime(offer.expires_at)}</span>
              </div>
            )}
          </div>

          {/* Messages */}
          {(offer.message || (status === 'countered' && offer.counter_message)) && (
            <div className="mt-3 space-y-1.5">
              {offer.message && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <MessageSquareQuote className="w-3.5 h-3.5 shrink-0 mt-px opacity-60" />
                  <span className="italic">"{offer.message}"</span>
                </p>
              )}
              {status === 'countered' && offer.counter_message && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-px opacity-60" />
                  <span className="italic">"{offer.counter_message}"</span>
                </p>
              )}
            </div>
          )}

          {/* What the state means for this user */}
          {isPending && !isReceived && (
            <p className="text-xs text-muted-foreground mt-3">
              You're committed to buy at this price if the seller accepts. Withdraw it before then if you've changed your mind.
            </p>
          )}
          {status === 'accepted' && !isReceived && listingActive && (
            <p className="text-xs text-muted-foreground mt-3">
              Deal agreed — you're committed to buy.
              {offer.payment_due_at && (
                <> Please pay by <strong className="text-foreground">{formatDateTime(offer.payment_due_at)}</strong> or the deal lapses.</>
              )}
            </p>
          )}

          {/* Counterparty */}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            {other && (
              <>
                <ProfileAvatar profile={other} size="xs" />
                <span>
                  {isReceived ? 'From' : 'To'}{' '}
                  {otherPath ? (
                    <Link to={otherPath} className="font-bold text-foreground hover:text-primary transition-colors">{otherName}</Link>
                  ) : (
                    <span className="font-bold text-foreground">{otherName}</span>
                  )}
                </span>
              </>
            )}
            {detailPath && (
              <Link to={detailPath} className={`inline-flex items-center gap-1 font-semibold text-primary hover:underline ${other ? 'ml-auto' : ''}`}>
                View listing <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 self-start sm:self-center sm:w-40 sm:items-stretch sm:pl-4 sm:border-l sm:border-border">
          {actions}
        </div>
      )}
    </div>
  );
};

// ── Empty states (the Watchlist's shape) ──────────────────────────────────────
const EmptyState = ({ perspective }) => (
  <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-sm">
    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${perspective === 'received' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
      {perspective === 'received'
        ? <Inbox className="w-8 h-8 text-primary opacity-80" />
        : <Tag className="w-8 h-8 text-amber-600 opacity-80" />}
    </div>
    {perspective === 'received' ? (
      <>
        <h3 className="text-xl font-bold mb-2">No received offers</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mb-6">
          When a buyer makes an offer on one of your listings it lands here, where you can accept, counter or decline it.
        </p>
        <Button asChild variant="outline" className="rounded-xl font-bold">
          <Link to="/account/listings">Manage my listings</Link>
        </Button>
      </>
    ) : (
      <>
        <h3 className="text-xl font-bold mb-2">No sent offers</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mb-6">
          Most buy-now listings take offers. Find a card you like and make the seller an offer from its page.
        </p>
        <Button asChild className="rounded-xl font-bold">
          <Link to="/marketplace">Browse Marketplace</Link>
        </Button>
      </>
    )}
  </div>
);

const RowSkeleton = () => (
  <div className="flex gap-4 p-4 sm:p-5 rounded-2xl border border-border bg-card">
    <Skeleton className="w-16 h-20 rounded-lg shrink-0" />
    <div className="flex-1 space-y-2 py-1">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-5 w-24 mt-3" />
    </div>
  </div>
);

const CountPill = ({ n }) => (
  n > 0 ? (
    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center leading-none">
      {n}
    </span>
  ) : null
);

// ── Page ──────────────────────────────────────────────────────────────────────
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
            buyer:profiles!buyer_id(id, display_name, username, avatar_url, is_admin, rating, reviews_count)
          `)
          .eq('seller_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select(`
            *,
            listing:listings(id, status, price_aud, price_min_aud, price_max_aud, listing_type, vault_item:vault_items(card_name, card_image)),
            seller:profiles!seller_id(id, display_name, username, avatar_url, is_admin, rating, reviews_count)
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

  // What's waiting on whom — the summary tiles and the tab counts.
  const summary = useMemo(() => {
    const needsReply = received.filter((o) => effectiveStatus(o) === 'pending').length;
    const awaitingSeller = sent.filter((o) => effectiveStatus(o) === 'pending').length;
    const counters = sent.filter((o) => effectiveStatus(o) === 'countered').length;
    const toPay = sent.filter(awaitingPayment).length;
    return { needsReply, awaitingSeller, counters, toPay, sentActionable: counters + toPay };
  }, [received, sent]);

  const renderList = (offers, perspective) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
        </div>
      );
    }
    if (offers.length === 0) return <EmptyState perspective={perspective} />;
    return (
      <div className="space-y-3">
        {offers.map((offer) => (
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

  const total = received.length + sent.length;

  return (
    <AccountPageShell
      documentTitle="Offers | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Offers' }]}
      title="Offers"
      description={loading
        ? 'Loading…'
        : total === 0
          ? 'Offers you make on cards, and offers buyers make on yours.'
          : `${received.length} received · ${sent.length} sent`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={fetchOffers} disabled={loading} className="rounded-xl shadow-sm h-10 px-4 font-bold">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button asChild size="sm" className="rounded-xl shadow-sm h-10 px-4 font-bold">
            <Link to="/marketplace">
              <Search className="w-4 h-4 mr-2" /> Browse Marketplace
            </Link>
          </Button>
        </>
      }
    >
      {/* Summary tiles — same card as the dashboard's stats grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        <StatTile
          title="Needs your reply"
          value={summary.needsReply}
          hint="Offers on your listings waiting for an answer"
          icon={Inbox}
          tint="text-amber-500"
          loading={loading}
        />
        <StatTile
          title="Awaiting sellers"
          value={summary.awaitingSeller}
          hint="Offers you've made that are still binding"
          icon={Send}
          tint="text-primary"
          loading={loading}
        />
        <StatTile
          title="Ready to pay"
          value={summary.toPay}
          hint="Accepted offers inside their 48-hour payment window"
          icon={CreditCard}
          tint="text-emerald-500"
          loading={loading}
        />
      </div>

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="h-10 rounded-xl p-1">
          <TabsTrigger value="received" className="rounded-lg px-4 font-bold gap-2">
            Received <CountPill n={summary.needsReply} />
          </TabsTrigger>
          <TabsTrigger value="sent" className="rounded-lg px-4 font-bold gap-2">
            Sent <CountPill n={summary.sentActionable} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-5">
          {renderList(received, 'received')}
        </TabsContent>

        <TabsContent value="sent" className="mt-5">
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
