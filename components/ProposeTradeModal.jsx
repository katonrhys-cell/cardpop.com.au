import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, ImageOff, MessageSquare, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTradeRequests } from '@/hooks/useTradeRequests.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { toast } from 'sonner';

const cardImage = (vaultItem) =>
  publicImageUrl(
    vaultItem?.vault_images?.[0]?.storage_path
      || vaultItem?.card_image
      || null,
  );

const cardValue = (listing) =>
  Number(
    listing?.vault_item?.trade_value_aud
      ?? listing?.price_aud
      ?? listing?.vault_item?.estimated_value_aud
      ?? 0,
  );

// Card-for-card trade proposal with an automatic cash top-up: pick one of
// your own active listings to offer against the listing you're viewing. The
// value difference becomes `cash_topup_aud` on the trades row (computed in
// useTradeRequests.proposeTrade), settled between the parties when the trade
// is accepted. `listing` needs: id, sellerId, name, value.
const ProposeTradeModal = ({ listing, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const { proposeTrade } = useTradeRequests();

  const [myListings, setMyListings] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);
  const [myValue, setMyValue] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, price_aud, listing_type, accepts_trade, vault_item:vault_items!inner(id, card_name, set_name, grade, grading_company, card_image, trade_value_aud, estimated_value_aud, vault_images(storage_path))')
        .eq('seller_id', currentUser?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load your listings:', error);
        toast.error('Could not load your listings. Please try again.');
        setMyListings([]);
        return;
      }
      setMyListings(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const selected = useMemo(
    () => myListings?.find(l => l.id === selectedId) ?? null,
    [myListings, selectedId],
  );

  const select = (l) => {
    setSelectedId(l.id);
    setMyValue(String(cardValue(l) || ''));
  };

  const theirValue = Number(listing.value || 0);
  const mine = Number(myValue || 0);
  const diff = Math.round((theirValue - mine) * 100) / 100;

  const handleSubmit = async () => {
    if (!selected) { toast.error('Pick one of your cards to offer'); return; }
    if (!(mine > 0)) { toast.error('Enter your card\'s trade value'); return; }
    setSaving(true);
    try {
      const trade = await proposeTrade({
        initiatorListingId: selected.id,
        responderListingId: listing.id,
        responderId: listing.sellerId,
        initiatorValue: mine,
        responderValue: theirValue,
        message: message.trim() || null,
      });
      if (trade) {
        onSuccess?.(trade);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Propose a trade
          </DialogTitle>
          <DialogDescription>
            Offer one of your listed cards for <span className="font-semibold text-foreground">{listing.name}</span>.
            Any value difference is settled in cash when the trade is accepted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Own-card picker */}
          <div className="space-y-2">
            <Label className="font-semibold text-sm">Your card to offer</Label>
            {myListings === null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ) : myListings.length === 0 ? (
              <div className="bg-muted/40 rounded-2xl p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-foreground">You have no active listings to trade</p>
                <p className="text-xs text-muted-foreground">
                  A trade offers one of your listed cards. List a card first, then come back.
                </p>
                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
                  <Link to="/vault/add">List a card</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {myListings.map(l => {
                  const vi = l.vault_item;
                  const img = cardImage(vi);
                  const isSelected = l.id === selectedId;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => select(l)}
                      className={`text-left rounded-xl border p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className="aspect-[3/4] rounded-lg bg-muted/40 overflow-hidden mb-2 flex items-center justify-center">
                        {img
                          ? <img src={img} alt={vi?.card_name || 'Card'} className="w-full h-full object-cover" loading="lazy" />
                          : <ImageOff className="w-6 h-6 text-muted-foreground opacity-50" />}
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">{vi?.card_name || 'Unnamed card'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[vi?.set_name, vi?.grading_company && vi?.grade && `${String(vi.grading_company).toUpperCase()} ${vi.grade}`].filter(Boolean).join(' · ') || ' '}
                      </p>
                      <p className="text-xs font-semibold text-primary tabular-nums">${cardValue(l).toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Values + top-up */}
          {selected && (
            <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Your card's trade value (AUD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={myValue}
                    onChange={e => setMyValue(e.target.value)}
                    className="rounded-xl bg-background border-border h-10 tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Their card's value (AUD)</Label>
                  <p className="h-10 flex items-center px-3 rounded-xl bg-background border border-border font-bold tabular-nums">
                    ${theirValue.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <p className="text-sm font-semibold text-foreground">
                {diff === 0 && 'Even trade — no cash changes hands.'}
                {diff > 0 && <>You add <span className="text-primary tabular-nums">${Math.abs(diff).toFixed(2)}</span> cash to balance the trade.</>}
                {diff < 0 && <>They add <span className="text-primary tabular-nums">${Math.abs(diff).toFixed(2)}</span> cash to balance the trade.</>}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-semibold text-sm">Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Anything the other collector should know about your card or the deal..."
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 500))}
              className="rounded-xl bg-background border-border resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-bold" disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selected || saving} className="flex-1 rounded-xl font-bold gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send trade proposal'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Prefer to talk first? You can also message the seller from their profile.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ProposeTradeModal;
