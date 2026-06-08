import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft, AlertCircle, ImageOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const TradeOfferModal = ({ isOpen, onClose, targetCard }) => {
  const { currentUser } = useAuth();
  const [myCards, setMyCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser && targetCard) {
      const fetchEligibleCards = async () => {
        setLoading(true);
        try {
          // Fetch user's vault items
          const { data: cards, error: cardsErr } = await supabase
            .from('vault_items')
            .select('*')
            .eq('owner_id', currentUser.id);
          if (cardsErr) throw cardsErr;

          // Fetch pending trades to filter out busy cards
          const { data: pendingTrades, error: tradesErr } = await supabase
            .from('trades')
            .select('initiator_listing_id, responder_listing_id')
            .or(`initiator_id.eq.${currentUser.id},responder_id.eq.${currentUser.id}`)
            .eq('status', 'pending');
          if (tradesErr) throw tradesErr;

          const busyCardIds = (pendingTrades || []).flatMap(t => [t.initiator_listing_id, t.responder_listing_id]);
          const available = (cards || []).filter(c => !busyCardIds.includes(c.id));
          
          setMyCards(available);
        } catch (error) {
          console.error(error);
          toast.error("Failed to load your vault inventory.");
        } finally {
          setLoading(false);
        }
      };
      fetchEligibleCards();
      setSelectedCard(null);
    }
  }, [isOpen, currentUser, targetCard]);

  const handleSubmit = async () => {
    if (!selectedCard || !targetCard) return;
    setSubmitting(true);
    
    try {
      const myCardValue = Number(selectedCard.trade_value_locked || selectedCard.estimated_value_aud || 0);
      const targetCardValue = Number(targetCard.trade_value_locked || targetCard.estimated_value_aud || 0);
      const fee = myCardValue * 0.03;
      const finalAmount = myCardValue - fee;

      const recipientId = targetCard.owner_id || targetCard.owner;

      if (!recipientId) {
        throw new Error("Unable to determine recipient ID.");
      }

      if (recipientId === currentUser.id) {
        throw new Error("You cannot trade with yourself.");
      }

      const { error: tradeError } = await supabase.from('trades').insert({
        initiator_id: currentUser.id,
        initiator_listing_id: selectedCard.id,
        responder_id: recipientId,
        responder_listing_id: targetCard.id,
        initiator_listing_value: myCardValue,
        responder_listing_value: targetCardValue,
        fee_amount: fee,
        final_amount: finalAmount,
        status: 'pending'
      });
      if (tradeError) throw tradeError;
      
      toast.success("Trade offer submitted successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to submit trade offer.");
    } finally {
      setSubmitting(false);
    }
  };

  // Values calculation
  const myValue = selectedCard ? Number(selectedCard.trade_value_locked || selectedCard.estimated_value_aud || 0) : 0;
  const theirValue = targetCard ? Number(targetCard.trade_value_locked || targetCard.estimated_value_aud || 0) : 0;
  const fee = myValue * 0.03;
  const finalAmount = myValue - fee;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border rounded-[2rem] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 md:p-8 border-b border-border bg-muted/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif font-bold text-foreground flex items-center gap-3">
              <ArrowRightLeft className="w-6 h-6 text-primary" /> Initiate Trade
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Select a card from your vault to offer in exchange for <strong>{targetCard?.cardName}</strong>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          {/* Target Card Quick Summary */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
            <div className="w-12 h-16 bg-background rounded overflow-hidden shrink-0 border border-border shadow-sm flex items-center justify-center">
               {(targetCard?.image_urls?.[0] || targetCard?.cardImage) ? (
                 <img src={targetCard?.image_urls?.[0] || (Array.isArray(targetCard.cardImage) ? targetCard.cardImage[0] : targetCard.cardImage)} alt="Target" className="w-full h-full object-cover" />
               ) : <ImageOff className="w-4 h-4 text-muted-foreground opacity-50" />}
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Their Card</p>
              <p className="font-bold text-foreground line-clamp-1">{targetCard?.cardName}</p>
              <p className="text-sm text-muted-foreground">Market Value: <strong className="text-foreground">${theirValue.toFixed(2)}</strong></p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Select Your Offer</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : myCards.length === 0 ? (
              <div className="text-center p-8 bg-muted/30 border border-border border-dashed rounded-2xl">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="font-bold text-foreground mb-1">No eligible cards available</p>
                <p className="text-sm text-muted-foreground text-balance">
                  Your vault is empty, or all your cards are currently locked in other pending trades.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {myCards.map(card => {
                  const isSelected = selectedCard?.id === card.id;
                  const imgUrl = card.image_urls && card.image_urls.length > 0
                    ? card.image_urls[0]
                    : null;

                  return (
                    <div 
                      key={card.id} 
                      onClick={() => setSelectedCard(card)}
                      className={`relative cursor-pointer rounded-xl border-2 transition-all p-3 flex flex-col group ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 bg-background rounded-full">
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="aspect-[3/4] rounded-lg mb-3 overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
                        {imgUrl ? (
                          <img src={imgUrl} alt={card.cardName} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <ImageOff className="w-6 h-6 text-muted-foreground opacity-30" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-foreground line-clamp-1 mb-1" title={card.card_name || card.cardName}>{card.card_name || card.cardName}</p>
                      <Badge variant="secondary" className="w-fit text-[10px] mb-2">{card.condition}</Badge>
                      <p className="text-sm font-extrabold tabular-nums mt-auto">
                        ${Number(card.trade_value_locked || card.estimated_value_aud || 0).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedCard && (
            <div className="bg-secondary/10 p-5 rounded-2xl border border-secondary/20">
              <h3 className="text-sm font-bold uppercase tracking-wider text-secondary-foreground mb-4">Value Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Your Card Value</span>
                  <span className="font-bold tabular-nums text-foreground">${myValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Their Card Value</span>
                  <span className="font-bold tabular-nums text-foreground">${theirValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive pt-2 border-t border-border/50">
                  <span>Platform Fee (3%)</span>
                  <span className="font-bold tabular-nums">-${fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-foreground pt-2 border-t border-border font-bold text-lg">
                  <span>Final Trade Value</span>
                  <span className="tabular-nums">${finalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-card flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={submitting} className="font-bold rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedCard || submitting} className="font-bold rounded-xl px-8 shadow-sm">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Submit Offer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeOfferModal;