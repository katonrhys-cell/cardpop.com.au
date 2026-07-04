import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRightLeft, ImageOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { publicImageUrl } from '@/utils/imageUrl.js';

// Storage path or absolute URL → CDN-aware public URL.
const resolveImageUrl = (path) => publicImageUrl(path);

// The trade row exposes a 'proposed' status while it awaits a response; older
// data may use 'pending'. Both mean "awaiting action".
const isActionableStatus = (status) => status === 'proposed' || status === 'pending';

const getStatusConfig = (status) => {
  switch (status) {
    case 'accepted':
      return { icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-primary/10 text-primary border-primary/20' };
    case 'declined':
    case 'cancelled':
      return { icon: <XCircle className="w-4 h-4" />, color: 'bg-destructive/10 text-destructive border-destructive/20' };
    default:
      return { icon: <Clock className="w-4 h-4" />, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
  }
};

const TradeCard = ({ trade, isSent, isHistory, onAccept, onDecline, onCancel }) => {
  const [processing, setProcessing] = useState(false);

  const statusConfig = getStatusConfig(trade.status);
  const actionable = isActionableStatus(trade.status);

  // Left card is always the initiator's listing, right is always the responder's.
  // Only the labels change depending on whether the viewer sent the offer.
  const offerListing = trade.initiator_listing;
  const receiveListing = trade.responder_listing;
  const offerValue = trade.initiator_trade_value_aud;
  const receiveValue = trade.responder_trade_value_aud;
  const cashTopup = Number(trade.cash_topup_aud || 0);

  const renderCardSummary = (listing, value, label, highlight) => {
    const vaultItem = listing?.vault_item;
    if (!vaultItem) {
      return (
        <div className={`flex-1 p-4 rounded-xl border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} flex flex-col items-center justify-center text-center`}>
          <ImageOff className="w-8 h-8 text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm font-bold text-foreground">Card Unavailable</p>
          <p className="text-xs text-muted-foreground">This card may have been deleted.</p>
        </div>
      );
    }

    const rawImg = vaultItem.vault_images?.[0]?.storage_path
      || vaultItem.card_image
      || vaultItem.vault_images?.[0]?.image_url
      || vaultItem.image_url
      || null;
    const imgUrl = resolveImageUrl(rawImg);
    const cardName = vaultItem.card_name || vaultItem.name || 'Unnamed card';
    const displayValue = Number(value ?? vaultItem.estimated_value_aud ?? listing.price_aud ?? 0);

    return (
      <div className={`flex-1 p-4 rounded-xl border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} flex flex-col`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
        </p>
        <div className="flex gap-4 items-start">
          <div className="w-16 h-20 bg-background border border-border rounded-lg overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
            {imgUrl ? (
              <img src={imgUrl} alt={cardName} className="w-full h-full object-cover" />
            ) : (
              <ImageOff className="w-6 h-6 text-muted-foreground opacity-30" />
            )}
          </div>
          <div className="flex flex-col">
            <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-1">{cardName}</h4>
            <span className="text-xs text-muted-foreground mb-2">{vaultItem.condition}</span>
            <span className="text-lg font-bold tabular-nums text-foreground mt-auto">
              ${displayValue.toFixed(2)}
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
            {actionable && (
              <Badge variant="secondary" className="px-2.5 py-0.5">
                {isSent ? 'You Offered' : 'Incoming Offer'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Initiated: {new Date(trade.created_at || trade.created).toLocaleDateString()}</p>
        </div>

        {cashTopup > 0 && (
          <div className="text-right flex items-center gap-4 bg-muted/40 px-4 py-2 rounded-xl border border-border/50">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Cash Top-up</span>
              <span className="text-lg font-bold tabular-nums text-foreground">${cashTopup.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch mb-6">
        {renderCardSummary(offerListing, offerValue, isSent ? 'You Offer' : 'They Offer', false)}

        <div className="flex items-center justify-center shrink-0">
          <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-sm">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
        </div>

        {renderCardSummary(receiveListing, receiveValue, isSent ? 'They Provide' : 'You Provide', true)}
      </div>

      {!isHistory && actionable && (
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
