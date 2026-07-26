import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { toast } from 'sonner';
import { Loader2, Lock, ShoppingCart, ArrowRightLeft, Layers, DollarSign, TrendingUp, Tag, RotateCcw, HandCoins } from 'lucide-react';
import PriceRangeIndicator from '@/components/PriceRangeIndicator.jsx';
import SellingRequirementsNotice from '@/components/SellingRequirementsNotice.jsx';
import { isSellingEntitlementError } from '@/utils/listingErrors.js';
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
  {
    key: 'Expression of Interest',
    label: 'Expression of Interest',
    icon: HandCoins,
    className: 'hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500/30',
    badgeClass: 'bg-sky-500/10 text-sky-700 border-sky-200',
    listingType: 'expression_of_interest',
    isPublic: true,
    needsRange: true,
  },
];

const VaultListingModal = ({ isOpen, onClose, product, onUpdate }) => {
  const { currentUser } = useAuth();
  const { settings } = usePlatformSettings();
  // Trade listing choices only exist while the enable_trading flag is on
  const visibleOptions = OPTIONS.filter(
    (opt) => !opt.needsTrade || settings.enable_trading !== false
  );
  const [selected, setSelected] = useState(null);
  const [price, setPrice] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [tradeWants, setTradeWants] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceRange, setPriceRange] = useState(null);
  const [hasActiveListing, setHasActiveListing] = useState(false);
  const [listingStatus, setListingStatus] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const handleOpen = () => {
    setSelected(null);
    setPrice(product?.estimated_value_aud ? String(product.estimated_value_aud) : '');
    setRangeMin('');
    setRangeMax('');
    setTradeWants('');
    setPriceRange(null);
    setHasActiveListing(false);
    setListingStatus(null);

    // Check if a live (non-archived) listing row exists and track its status so
    // the seller can mark it Sold / relist it (guards against orphaned state).
    supabase
      .from('listings')
      .select('id, status, price_min_aud, price_max_aud')
      .eq('vault_item_id', product.id)
      .neq('status', 'archived')
      .maybeSingle()
      .then(({ data }) => {
        setHasActiveListing(!!data);
        setListingStatus(data?.status ?? null);
        if (data?.price_min_aud != null) setRangeMin(String(data.price_min_aud));
        if (data?.price_max_aud != null) setRangeMax(String(data.price_max_aud));
      });

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

  // Every mount controls the dialog purely via the isOpen prop (no
  // DialogTrigger), and Radix only calls onOpenChange for its own internal
  // interactions — so the open/reset logic must run from an effect. Keyed on
  // the card identity too, so opening for a different card fully resets the
  // selection/price state and reloads its listing + market price range.
  useEffect(() => {
    if (isOpen && product?.id) handleOpen();
  }, [isOpen, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (opt) => {
    setSelected(opt);
    if (opt.needsPrice && !price) {
      setPrice(product?.estimated_value_aud ? String(product.estimated_value_aud) : '');
    }
    // Suggest a range around the estimated value the first time EOI is picked.
    if (opt.needsRange && !rangeMin && !rangeMax && product?.estimated_value_aud) {
      const ev = Number(product.estimated_value_aud);
      setRangeMin((ev * 0.8).toFixed(2));
      setRangeMax((ev * 1.2).toFixed(2));
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

    if (selected.needsRange) {
      const min = Number(rangeMin);
      const max = Number(rangeMax);
      if (!rangeMin || isNaN(min) || min <= 0 || !rangeMax || isNaN(max) || max <= 0) {
        toast.error('Please enter the price range you are looking for.');
        return;
      }
      if (max < min) {
        toast.error('The maximum of your price range must be at least the minimum.');
        return;
      }
      if (effectiveFloor !== null && max < effectiveFloor) {
        toast.error('The top of this price range is below the minimum allowed for this listing. Please raise it.');
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

      let listingStatusAfterSave = null;
      if (selected.isPublic) {
        // Upsert a listings row so the card appears in the marketplace
        const listingPayload = {
          vault_item_id: product.id,
          seller_id: currentUser.id,
          listing_type: selected.listingType,
          status: 'active',
          // 'For Sale & Trade' (listing_type 'fixed') and 'For Trade' both accept
          // trades — this flag is what the marketplace trade filter matches on,
          // so a fixed-price-but-trade-open listing is no longer invisible to it.
          accepts_trade: !!selected.needsTrade,
          price_aud: selected.needsPrice ? Number(price) : null,
          // Expression of Interest: no fixed price — publish the range the
          // seller wants offers in, and flag the listing as offer-enabled so
          // the marketplace "Make Offer" filter picks it up.
          price_min_aud: selected.needsRange ? Number(rangeMin) : null,
          price_max_aud: selected.needsRange ? Number(rangeMax) : null,
          // Always write the flag (like accepts_trade) — a conditional spread
          // left accepts_offers=true behind when an EOI listing was switched to
          // For Sale/Trade, so it kept showing under the marketplace "Make Offer"
          // filter and accepted offers the seller never opted into.
          accepts_offers: !!selected.needsRange,
          trade_wants: selected.needsTrade ? (tradeWants.trim() || null) : null,
          listed_at: new Date().toISOString(),
        };

        // Check if an active/non-archived listing already exists for this vault item.
        // Must check the error: maybeSingle() errors when >1 non-archived row
        // exists, and a transient failure also yields data=undefined — either
        // would otherwise fall through to the INSERT branch and create a second
        // live listing for the same card.
        const { data: existing, error: existingErr } = await supabase
          .from('listings')
          .select('id')
          .eq('vault_item_id', product.id)
          .neq('status', 'archived')
          .maybeSingle();
        if (existingErr) throw existingErr;

        // Read the status back: the enforce_listing_approval trigger may hold
        // a new listing at 'pending', and the seller needs to know it isn't
        // visible on the marketplace yet.
        if (existing) {
          const { data: updated, error: updateErr } = await supabase
            .from('listings')
            .update(listingPayload)
            .eq('id', existing.id).eq('seller_id', currentUser.id)
            .select('status').single();
          if (updateErr) throw updateErr;
          listingStatusAfterSave = updated?.status ?? null;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('listings')
            .insert(listingPayload)
            .select('status').single();
          if (insertErr) throw insertErr;
          listingStatusAfterSave = inserted?.status ?? null;
        }
      } else {
        // Going private — archive any existing listing
        const { error: archiveErr } = await supabase
          .from('listings')
          .update({ status: 'archived' })
          .eq('vault_item_id', product.id).eq('seller_id', currentUser.id);
        if (archiveErr) throw archiveErr;
      }

      if (listingStatusAfterSave === 'pending') {
        toast.success('Listing submitted — it will appear on the marketplace once approved.', { duration: 8000 });
      } else {
        toast.success(`Card updated: ${selected.label}`);
      }
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Listing update error:', error);
      if (isSellingEntitlementError(error)) {
        toast.error(
          "Your card can't go live yet — selling requires identity verification and a card on file. Finish those two steps, then try again.",
          { duration: 10000 }
        );
      } else {
        toast.error(error.message || 'Failed to update listing.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Flip an existing marketplace listing between 'sold' and 'active'. Marking it
  // sold keeps the card visible on the marketplace badged "Sold" (it isn't
  // archived) and, because checkout only accepts 'active' listings, stops it from
  // being sold to anyone else.
  const handleSetListingStatus = async (newStatus) => {
    if (!product) return;
    setStatusSaving(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .update({
          status: newStatus,
          sold_at: newStatus === 'sold' ? new Date().toISOString() : null,
        })
        .eq('vault_item_id', product.id)
        .eq('seller_id', currentUser.id)
        .neq('status', 'archived')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('No live listing found to update.');
        return;
      }
      setListingStatus(newStatus);
      toast.success(newStatus === 'sold' ? 'Card marked as sold.' : 'Card relisted — available again.');
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Listing status update error:', error);
      toast.error(error.message || 'Failed to update listing status.');
    } finally {
      setStatusSaving(false);
    }
  };

  if (!product) return null;

  const currentOpt = OPTIONS.find(o => o.key === (product.listing_type || 'Private')) || OPTIONS[0];
  const CurrentIcon = currentOpt.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
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

          {/* Going public is denied by the can_sell() RLS gate until identity
              verification + card on file are done — warn before the attempt.
              Self-hides once the user can sell; hidden when going Private. */}
          {(!selected || selected.isPublic) && <SellingRequirementsNotice />}

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
            {visibleOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = selected?.key === opt.key;
              return (
                <Button
                  key={opt.key}
                  variant="outline"
                  className={`w-full justify-start h-11 rounded-xl font-medium transition-colors ${opt.className} ${isActive ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => handleSelect(opt)}
                  disabled={loading || (product.listing_type === opt.key && hasActiveListing)}
                >
                  <Icon className="w-4 h-4 mr-3 shrink-0" />
                  {opt.label}
                </Button>
              );
            })}
          </div>

          {/* Sold / relist — only relevant once the card has a live marketplace listing */}
          {hasActiveListing && (
            listingStatus === 'sold' ? (
              <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-brand-red text-white font-bold uppercase tracking-wider px-2.5 py-1">Sold</Badge>
                  <span className="text-xs text-muted-foreground">Shown as sold on the marketplace — not purchasable.</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start h-10 rounded-xl font-medium"
                  onClick={() => handleSetListingStatus('active')}
                  disabled={statusSaving || loading}
                >
                  {statusSaving ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-3 shrink-0" />}
                  Relist (mark available again)
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start h-11 rounded-xl font-medium hover:bg-brand-red/10 hover:text-brand-red hover:border-brand-red/30"
                onClick={() => handleSetListingStatus('sold')}
                disabled={statusSaving || loading}
              >
                {statusSaving ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <Tag className="w-4 h-4 mr-3 shrink-0" />}
                Mark as Sold
              </Button>
            )
          )}

          {selected && (selected.needsPrice || selected.needsTrade || selected.needsRange) && (
            <div className="space-y-4 border border-border rounded-xl p-4 bg-muted/20">
              {selected.needsRange && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Price range you're looking for (AUD) *</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={rangeMin}
                        onChange={e => setRangeMin(e.target.value)}
                        placeholder="Min"
                        className="pl-9 bg-background"
                      />
                    </div>
                    <span className="text-muted-foreground font-bold">–</span>
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={rangeMax}
                        onChange={e => setRangeMax(e.target.value)}
                        placeholder="Max"
                        className={`pl-9 bg-background ${effectiveFloor !== null && rangeMax !== '' && Number(rangeMax) < effectiveFloor ? 'border-destructive' : ''}`}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Buyers will see this range and make offers — you can accept, decline or counter each one.
                  </p>
                </div>
              )}
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
