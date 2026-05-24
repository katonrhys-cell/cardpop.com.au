import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRightLeft, ImageOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import pb from '@/lib/pocketbaseClient.js';

const TradeCard = ({ trade, isSent, isHistory, onAccept, onDecline, onCancel }) => {
  const [processing, setProcessing] = useState(false);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'accepted': return { icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-primary/10 text-primary border-primary/20' };
      case 'declined': return { icon: <XCircle className="w-4 h-4" />, color: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'pending': default: return { icon: <Clock className="w-4 h-4" />, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    }
  };

  const statusConfig = getStatusConfig(trade.status);

  const renderCardSummary = (card, label, highlight) => {
    if (!card) {
      return (
        <div className={`flex-1 p-4 rounded-xl border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} flex flex-col items-center justify-center text-center`}>
          <ImageOff className="w-8 h-8 text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm font-bold text-foreground">Card Unavailable</p>
          <p className="text-xs text-muted-foreground">This card may have been deleted.</p>
        </div>
      );
    }

    const imgUrl = card.cardImage && card.cardImage.length > 0 
      ? pb.files.getUrl(card, Array.isArray(card.cardImage) ? card.cardImage[0] : card.cardImage)
      : null;

    return (
      <div className={`flex-1 p-4 rounded-xl border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} flex flex-col`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
        </p>
        <div className="flex gap-4 items-start">
          <div className="w-16 h-20 bg-background border border-border rounded-lg overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
            {imgUrl ? (
              <img src={imgUrl} alt={card.cardName} className="w-full h-full object-cover" />
            ) : (
              <ImageOff className="w-6 h-6 text-muted-foreground opacity-30" />
            )}
          </div>
          <div className="flex flex-col">
            <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-1">{card.cardName}</h4>
            <span className="text-xs text-muted-foreground mb-2">{card.condition}</span>
            <span className="text-lg font-bold tabular-nums text-foreground mt-auto">
              ${Number(card.tradeValue || card.estimatedValue || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const handleAction = async (actionFn) => {
    setProcessing(true);
    await actionFn(trade);
    setProcessing(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
      <div className="flex flex-wrap justify-between items-start mb-5 gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-0.5 capitalize ${statusConfig.color}`}>
              {statusConfig.icon}
              {trade.status}
            </Badge>
            {trade.status === 'pending' && (
              <Badge variant="secondary" className="px-2.5 py-0.5">
                {isSent ? 'You Offered' : 'Incoming Offer'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Initiated: {new Date(trade.created).toLocaleDateString()}</p>
        </div>
        
        <div className="text-right flex items-center gap-4 bg-muted/40 px-4 py-2 rounded-xl border border-border/50">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Fee Deducted</span>
            <span className="text-sm font-bold tabular-nums text-destructive">-${Number(trade.fee_amount || 0).toFixed(2)}</span>
          </div>
          <div className="w-px h-8 bg-border/80" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Final Value</span>
            <span className="text-lg font-bold tabular-nums text-foreground">${Number(trade.final_amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch mb-6">
        {renderCardSummary(
          isSent ? trade.offererCard : trade.offererCard, 
          isSent ? "You Offer" : "They Offer", 
          false
        )}
        
        <div className="flex items-center justify-center shrink-0">
          <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-sm">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
        </div>

        {renderCardSummary(
          isSent ? trade.recipientCard : trade.recipientCard, 
          isSent ? "They Provide" : "You Provide", 
          true
        )}
      </div>

      {!isHistory && trade.status === 'pending' && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50 mt-auto">
          {isSent ? (
            <Button variant="destructive" className="font-bold rounded-xl" onClick={() => handleAction(() => onCancel(trade.id))} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cancel Request
            </Button>
          ) : (
            <>
              <Button variant="outline" className="font-bold rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-border" onClick={() => handleAction(() => onDecline(trade.id))} disabled={processing}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Decline
              </Button>
              <Button className="font-bold rounded-xl shadow-sm px-6" onClick={() => handleAction(() => onAccept(trade))} disabled={processing}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Accept Trade
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TradeCard;