import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { Loader2, Lock, ShoppingCart, ArrowRightLeft, Layers, DollarSign, TrendingUp } from 'lucide-react';
import PriceRangeIndicator from '@/components/PriceRangeIndicator.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const OPTIONS = [
  {
    key: 'Private',
    label: 'Private (Vault Only)',
    icon: Lock,
    className: 'hover:bg-muted hover:border-muted-foreground/30',
    badgeClass: 'bg-muted text-muted-foreground',
    listingType: 'vault',
    isPublic: false,
  },
  {
    key: 'For Sale',
    label: 'List for Sale',
    icon: ShoppingCart,
    className: 'hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    listingType: 'fixed',
    isPublic: true,
    needsPrice: true,
  },
  {
    key: 'For Trade',
    label: 'List for Trade',
    icon: ArrowRightLeft,
    className: 'hover:bg-violet-500/10 hover:text-violet-600 hover:border-violet-500/30',
    badgeClass: 'bg-violet-500/10 text-violet-700 border-violet-200',
    listingType: 'trade',
    isPublic: true,
    needsTrade: true,
  },
  {
    key: 'For Sale & Trade',
    label: 'List for Sale & Trade',
    icon: Layers,
    className: 'hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30',
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-200',
    listingType: 'fixed',
    isPublic: true,
    needsPrice: true,
    needsTrade: true,
  },
];

const VaultListingModal = ({ isOpen, onClose, product, onUpdate }) => {
  const { currentUser } = useAuth();
  const [selected, setSelected] = useState(null);
  const [price, setPrice] = useState('');
  const [tradeWants, setTradeWants] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceRange, setPriceRange] = useState(null);

  const handleOpen = () => {
    setSelected(null);
    setPrice(product?.estimated_value_aud ? String(product.estimated_value_aud) : '');
    setTradeWants('');
    setPriceRange(null);

    // Fetch price range from DB if we have a CardSight card ID
    const csId = product?.cardsight_card_id;
    if (csId) {
      supabase
        .from('card_price_ranges')
        .select('*')
        .eq('card_id', csId)
        .maybeSingle()
        .then(({ data }) => { if (data) setPriceRange(data); });
    }
  };

  const handleSelect = (opt) => {
    setSelected(opt);
    if (opt.needsPrice && !price) {
      setPrice(product?.estimated_value_aud ? String(product.estimated_value_aud) : '');
    }
  };

  const lockedBaseValue = product?.locked_base_value_aud ?? null;

  // Effective minimum = max(locked base, market floor (low * 50%))
  const marketFloor = priceRange?.floor_aud ?? null;
  const effectiveFloor = Math.max(lockedBaseValue ?? 0, marketFloor ?? 0) || null;

  const handleConfirm = async () => {
    if (!product || !selected) return;

    if (selected.needsPrice && (!price || isNaN(Number(price)) || Number(price) <= 0)) {
      toast.error('Please enter a valid sale price.');
      return;
    }

    if (selected.needsPrice && effectiveFloor !== null && Number(price) < effectiveFloor) {
      toast.error('This price is below the minimum allowed for this listing. Please enter a higher amount.');
      return;
    }

    if (selected.needsTrade && effectiveFloor !== null) {
      const tv = Number(price);
      if (tv > 0 && tv < effectiveFloor) {
        toast.error('This trade value is below the minimum allowed for this listing. Please enter a higher amount.');
        return;
      }
    }

    setLoading(true);
    try {
      // Update vault item visibility/type
      const { error: vaultErr } = await supabase
        .from('vault_items')
        .update({
          listing_type: selected.key,
          is_public: selected.isPublic,
          ...(selected.needsTrade ? { trade_value_aud: Number(price) || product.trade_value_aud } : {}),
        })
        .eq('id', product.id).eq('owner_id', currentUser.id);
      if (vaultErr) throw vaultErr;

      if (selected.isPublic) {
        // Upsert a listings row so the card appears in the marketplace
        const listingPayload = {
          vault_item_id: product.id,
          seller_id: currentUser.id,
          listing_type: selected.listingType,
          status: 'active',
          price_aud: selected.needsPrice ? Number(price) : null,
          trade_wants: selected.needsTrade ? (tradeWants.trim() || null) : null,
          listed_at: new Date().toISOString(),
        };

        // Check if an active/non-archived listing already exists for this vault item
        const { data: existing } = await supabase
          .from('listings')
          .select('id')
          .eq('vault_item_id', product.id)
          .neq('status', 'archived')
          .maybeSingle();

        if (existing) {
          const { error: updateErr } = await supabase
            .from('listings')
            .update(listingPayload)
            .eq('id', existing.id).eq('seller_id', currentUser.id);
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from('listings')
            .insert(listingPayload);
          if (insertErr) throw insertErr;
        }
      } else {
        // Going private — archive any existing listing
        await supabase
          .from('listings')
          .update({ status: 'archived' })
          .eq('vault_item_id', product.id).eq('seller_id', currentUser.id);
      }

      toast.success(`Card updated: ${selected.label}`);
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Listing update error:', error);
      toast.error(error.message || 'Failed to update listing.');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const currentOpt = OPTIONS.find(o => o.key === (product.listing_type || 'Private')) || OPTIONS[0];
  const CurrentIcon = currentOpt.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (open) handleOpen(); else onClose(); }}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl border-border bg-background p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-serif font-bold text-foreground">
            Manage Listing
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Set visibility and pricing for <span className="font-bold text-foreground">{product.card_name || product.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="bg-muted/30 p-3 rounded-xl border border-border flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Current Status</span>
            <Badge className={`px-3 py-1 text-xs font-bold ${currentOpt.badgeClass}`}>
              <CurrentIcon className="w-3 h-3 mr-1.5 inline-block" />
              {currentOpt.label}
            </Badge>
          </div>

          {/* Price range indicator */}
          {priceRange && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-bold text-foreground">Market Price Range</p>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {priceRange.sources_used?.join(' · ')}
                </span>
              </div>
              <PriceRangeIndicator
                range={priceRange}
                currentPrice={price !== '' && !isNaN(Number(price)) ? Number(price) : null}
              />
            </div>
          )}


          <div className="space-y-2">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = selected?.key === opt.key;
              return (
                <Button
                  key={opt.key}
                  variant="outline"
                  className={`w-full justify-start h-11 rounded-xl font-medium transition-colors ${opt.className} ${isActive ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => handleSelect(opt)}
                  disabled={loading || product.listing_type === opt.key}
                >
                  <Icon className="w-4 h-4 mr-3 shrink-0" />
                  {opt.label}
                </Button>
              );
            })}
          </div>

          {selected && (selected.needsPrice || selected.needsTrade) && (
            <div className="space-y-4 border border-border rounded-xl p-4 bg-muted/20">
              {selected.needsPrice && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Sale Price (AUD) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder={product?.estimated_value_aud ? String(product.estimated_value_aud) : '0.00'}
                      className={`pl-9 bg-background ${effectiveFloor !== null && price !== '' && Number(price) < effectiveFloor ? 'border-destructive' : ''}`}
                    />
                  </div>
                </div>
              )}
              {selected.needsTrade && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">What are you looking for? <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    value={tradeWants}
                    onChange={e => setTradeWants(e.target.value)}
                    placeholder="e.g. PSA 10 Charizard, 1998 Topps, similar value cards…"
                    rows={2}
                    className="bg-background resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selected}
            className="rounded-xl font-bold"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {loading ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VaultListingModal;
