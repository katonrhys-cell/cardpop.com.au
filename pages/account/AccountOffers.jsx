import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Tag, CheckCircle2, XCircle, Undo2, Clock, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  accepted:  { label: 'Accepted',  className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  declined:  { label: 'Declined',  className: 'bg-destructive/10 text-destructive border-destructive/20' },
  countered: { label: 'Countered', className: 'bg-violet-500/10 text-violet-700 border-violet-500/20' },
  expired:   { label: 'Expired',   className: 'bg-muted text-muted-foreground border-border' },
  withdrawn: { label: 'Withdrawn', className: 'bg-muted text-muted-foreground border-border' },
};

const formatCurrency = (val) => `$${(Number(val) || 0).toFixed(2)}`;
const formatDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const OfferCard = ({ offer, perspective, onAction, actionLoading }) => {
  const isReceived = perspective === 'received';
  const other = isReceived ? offer.buyer : offer.seller;
  const cardName = offer.listing?.vault_item?.card_name || 'Unknown Card';
  const listingPrice = offer.listing?.price_aud;
  const status = offer.status;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isPending = status === 'pending';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className={`font-bold text-xs ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(offer.created_at)}</span>
          {offer.expires_at && isPending && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" /> Expires {formatDate(offer.expires_at)}
            </span>
          )}
        </div>

        <h3 className="font-bold text-base mb-1 truncate">{cardName}</h3>
        {listingPrice && (
          <p className="text-xs text-muted-foreground mb-2">Listed at {formatCurrency(listingPrice)}</p>
        )}

        <p className="font-extrabold text-xl text-foreground tabular-nums mb-1">
          Offer: {formatCurrency(offer.amount_aud)}
        </p>

        {offer.message && (
          <p className="text-sm text-muted-foreground italic mt-1">"{offer.message}"</p>
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

      {isPending && (
        <div className="flex sm:flex-col gap-2 shrink-0 self-start sm:self-center">
          {isReceived ? (
            <>
              <Button
                size="sm"
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
                disabled={!!actionLoading}
                onClick={() => onAction(offer.id, 'accepted')}
              >
                {actionLoading === `${offer.id}_accept`
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl font-bold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                disabled={!!actionLoading}
                onClick={() => onAction(offer.id, 'declined')}
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
              onClick={() => onAction(offer.id, 'withdrawn')}
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

  const fetchOffers = useCallback(async () => {
    if (!currentUser?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [receivedRes, sentRes] = await Promise.all([
        supabase
          .from('offers')
          .select(`
            *,
            listing:listings(id, price_aud, vault_item:vault_items(card_name, card_image)),
            buyer:profiles!buyer_id(display_name, username, avatar_url, rating, reviews_count)
          `)
          .eq('seller_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select(`
            *,
            listing:listings(id, price_aud, vault_item:vault_items(card_name, card_image)),
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

  const handleAction = async (offerId, newStatus) => {
    const keyMap = { accepted: 'accept', declined: 'decline', withdrawn: 'withdraw' };
    setActionLoading(`${offerId}_${keyMap[newStatus]}`);
    try {
      const updateData = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'accepted' || newStatus === 'declined') {
        updateData.responded_at = new Date().toISOString();
      }
      const { error } = await supabase.from('offers').update(updateData).eq('id', offerId);
      if (error) throw error;
      const messages = { accepted: 'Offer accepted!', declined: 'Offer declined.', withdrawn: 'Offer withdrawn.' };
      toast.success(messages[newStatus]);
      fetchOffers();
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = received.filter(o => o.status === 'pending').length;

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
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Offers | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Offers' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Offers</h1>
        <p className="text-muted-foreground">Manage offers you've sent and received.</p>
      </div>

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
    </div>
  );
};

export default AccountOffers;
