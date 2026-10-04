
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { slugify } from '@/lib/slugify.js';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, X, Plus, Minus, Loader2, ArrowRight, PackageOpen } from 'lucide-react';
import { useCart, maxQuantityFor } from '@/hooks/useCart.jsx';
import { formatCurrency } from '@/utils/formatCurrency.js';
import BnplMessage from '@/components/BnplMessage.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { supabase } from '@/lib/supabaseClient.js';
import SoldBadge from '@/components/SoldBadge.jsx';
import PreorderNotice from '@/components/shop/PreorderNotice.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { marketplaceGate, hasMarketplaceLine } from '@/utils/marketplaceIdentity.js';
import { ShieldCheck, Truck } from 'lucide-react';

const aud = (n) => `$${Number(n || 0).toFixed(2)}`;

// Storage path or absolute URL → CDN-aware public URL.
const resolveImg = (path) => publicImageUrl(path);

const ShoppingCart = () => {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, getCartTotal } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const navigate = useNavigate();

  // The drawer stays mounted for the whole session (ShoppingCartLazy), so the
  // checkout spinner flag must be reset when the drawer reopens — otherwise the
  // button stays disabled forever after the first checkout.
  useEffect(() => {
    if (isCartOpen) setIsCheckingOut(false);
  }, [isCartOpen]);

  // A marketplace listing can sell to someone else while it sits in this cart.
  // Re-check listing statuses whenever the drawer opens so a sold one is pilled
  // "Sold" here, not only rejected later at checkout.
  const [soldIds, setSoldIds] = useState(() => new Set());
  const listingIdsKey = cartItems
    .filter((item) => item.product?.type === 'listing')
    .map((item) => item.product.id)
    .join(',');
  useEffect(() => {
    if (!isCartOpen || !listingIdsKey) return;
    let cancelled = false;
    supabase.from('listings').select('id, status').in('id', listingIdsKey.split(','))
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSoldIds(new Set(data.filter((r) => r.status === 'sold').map((r) => r.id)));
      }, () => {});
    return () => { cancelled = true; };
  }, [isCartOpen, listingIdsKey]);

  // The real total, not the subtotal. The drawer used to print the item
  // subtotal in bold as "Total", so the service fee, payment processing and
  // shipping first appeared on the payment page. Ask the same server endpoint
  // checkout uses (debounced, whenever the drawer is open and the lines change)
  // and show an itemised estimate; on any failure fall back to an honest
  // "fees & shipping at checkout" rather than a wrong number.
  const { currentUser, isIdentityVerified } = useAuth();
  const { settings } = usePlatformSettings();
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const linesKey = cartItems
    .map((item) => `${item.product?.type || 'listing'}:${item.product?.id}:${item.variant?.variant_id || ''}:${item.quantity}`)
    .join('|');
  useEffect(() => {
    if (!isCartOpen || !linesKey) { setEstimate(null); return; }
    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(() => {
      const items = cartItems
        .map((i) => ({ type: i.product?.type || 'listing', id: i.product?.id, quantity: i.quantity ?? 1, ...(i.variant?.variant_id ? { variantId: i.variant.variant_id } : {}) }))
        .filter((i) => i.id);
      apiServerClient.fetch('/stripe/calculate-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (!cancelled) setEstimate(data && typeof data.totalAud === 'number' ? data : null); })
        .catch(() => { if (!cancelled) setEstimate(null); })
        .finally(() => { if (!cancelled) setEstimating(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised lines
  }, [isCartOpen, linesKey]);

  // Free-shipping progress on CardPop Shop items ($15 flat under the
  // threshold, free from it — the rule lives in platform settings and is
  // priced server-side). Marketplace postage is per seller and not part of it.
  const shopSubtotalAud = cartItems.reduce((sum, item) => {
    if ((item.product?.type || 'listing') !== 'shop') return sum;
    const cents = item.variant?.sale_price_in_cents || item.variant?.price_in_cents || (item.product.price ? item.product.price * 100 : 0);
    return sum + (cents * item.quantity) / 100;
  }, 0);
  const freeShipAt = Number(settings.free_shipping_threshold_aud) || 0;
  const shipRate = Number(settings.default_shipping_rate_aud) || 0;
  const showShipBar = shopSubtotalAud > 0 && freeShipAt > 0 && shipRate > 0;
  const shipRemaining = Math.max(0, freeShipAt - shopSubtotalAud);

  // Say now what checkout will ask for — a free account for any marketplace
  // card, plus the one-time ID check once the cards reach the threshold.
  const gateLevel = marketplaceGate({
    lines: cartItems,
    thresholdAud: settings.marketplace_identity_threshold_aud,
    isAuthenticated: !!currentUser,
    isIdentityVerified,
  });
  const marketplaceInCart = hasMarketplaceLine(cartItems);

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    setIsCheckingOut(true);
    setIsCartOpen(false);
    // Guest checkout — no sign-in required. The multi-step CheckoutPage handles
    // shipping, review and Stripe payment, and offers account creation after
    // payment on the success page.
    navigate('/checkout');
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Numeric AUD subtotal for the "pay in 4" instalment line. getCartTotal()
  // returns a preformatted string, so recompute the raw amount the same way each
  // line item is priced above (sale price → variant price → product price).
  const numericTotalAud = cartItems.reduce((sum, item) => {
    const cents = item.variant?.sale_price_in_cents
      || item.variant?.price_in_cents
      || (item.product.price ? item.product.price * 100 : 0);
    return sum + cents * item.quantity;
  }, 0) / 100;

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 border-l border-border bg-background">
        <SheetHeader className="p-6 border-b border-border bg-muted/30">
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Your Cart
            {cartItemCount > 0 && (
              <span className="ml-2 text-sm font-sans font-medium bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full">
                {cartItemCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {cartItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-border/50">
              <PackageOpen className="w-12 h-12 text-muted-foreground opacity-60" />
            </div>
            <h3 className="text-2xl font-bold font-serif text-foreground mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-8 max-w-[250px] leading-relaxed">
              Looks like you haven't added any items to your cart yet. Discover your next great find in our shop.
            </p>
            <Button
              onClick={() => {
                setIsCartOpen(false);
                navigate('/shop');
              }}
              className="rounded-xl font-bold px-8 h-12 shadow-sm transition-transform active:scale-[0.98]"
            >
              Continue Shopping
            </Button>
          </motion.div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {cartItems.map((item) => {
                  const itemId = item.variant?.id || item.product.id;
                  const priceInCents = item.variant?.sale_price_in_cents || item.variant?.price_in_cents || (item.product.price ? item.product.price * 100 : 0);
                  const formattedPrice = formatCurrency(priceInCents, item.variant?.currency_info) || `$${(priceInCents / 100).toFixed(2)}`;
                  const rawImg = item.variant?.image_url || item.product.image || item.product.images?.[0] || null;
                  const imageUrl = resolveImg(rawImg);

                  const p = item.product;
                  const source = p.source || 'marketplace';
                  const slug = slugify(p.title || p.name || 'card');
                  const productPath = source === 'marketplace'
                    ? `/marketplace/${p.id}/${slug}`
                    : `/product/${source}/${p.id}/${slug}`;
                  const year = p.year || p.card_year || null;
                  const set = p.set || p.card_set || p.era || p.collection || null;
                  const gradingCompany = p.grading_company || p.gradingCompany || null;
                  const grade = p.grade || null;
                  const gradeLabel = gradingCompany && grade && gradingCompany !== 'raw'
                    ? `${gradingCompany.toUpperCase()} ${grade}`
                    : (grade ? `Grade ${grade}` : null);
                  // Marketplace listings are one-of-a-kind — the server charges
                  // quantity 1 regardless (cartService), so don't offer +/-.
                  const isListing = p.type === 'listing';
                  const isSold = isListing && soldIds.has(p.id);
                  const atMaxQuantity = item.quantity >= maxQuantityFor(item);
                  const itemName = p.title || p.name || 'item';

                  return (
                    <div key={itemId} className="flex gap-4 group">
                      <Link
                        to={productPath}
                        onClick={() => setIsCartOpen(false)}
                        className="relative w-20 h-24 rounded-xl overflow-hidden bg-muted border border-border shrink-0 hover:opacity-90 transition-opacity"
                      >
                        {isSold && <SoldBadge size="sm" className="absolute top-1 left-1 z-10" />}
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={p.title || p.name || 'Card'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-medium">
                            No Image
                          </div>
                        )}
                      </Link>

                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            {year && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{year}</p>}
                            <Link to={productPath} onClick={() => setIsCartOpen(false)}>
                            <h4 className="font-bold text-foreground line-clamp-2 leading-tight hover:text-primary transition-colors">
                              {p.title || p.name}
                            </h4>
                            </Link>
                            {set && <p className="text-xs text-muted-foreground mt-0.5">{set}</p>}
                            {gradeLabel && <p className="text-xs font-semibold text-primary mt-0.5">{gradeLabel}</p>}
                            {p.preorder && <PreorderNotice variant="inline" eta={p.preorderEta || 'Ships when stock arrives'} className="mt-1" />}
                            {!year && !set && !gradeLabel && item.variant?.title && item.variant.title !== 'Default Title' && (
                              <p className="text-sm text-muted-foreground mt-1">{item.variant.title}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2 shrink-0"
                            onClick={() => removeFromCart(itemId)}
                            aria-label={`Remove ${itemName} from cart`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          {isListing ? (
                            isSold
                              ? <span className="text-xs font-bold text-brand-red">No longer available — remove to check out</span>
                              : <span className="text-xs font-medium text-muted-foreground">Qty 1 · one of a kind</span>
                          ) : (
                          <div className="flex items-center border border-border rounded-lg bg-background">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none rounded-l-lg"
                              onClick={() => updateQuantity(itemId, item.quantity - 1)}
                              aria-label={`Decrease quantity of ${itemName}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none rounded-r-lg"
                              onClick={() => updateQuantity(itemId, item.quantity + 1)}
                              disabled={atMaxQuantity}
                              aria-label={atMaxQuantity ? `Increase quantity of ${itemName} (maximum available reached)` : `Increase quantity of ${itemName}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          )}
                          <span className="font-bold text-foreground tabular-nums">
                            {formattedPrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="p-6 bg-card border-t border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
              {showShipBar && (
                <div className="mb-4" data-testid="free-shipping-bar">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Truck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {shipRemaining > 0
                      ? <>Add <span className="font-bold text-foreground">{aud(shipRemaining)}</span> more of shop items for free shipping (otherwise {aud(shipRate)} flat)</>
                      : <span className="font-bold text-foreground">You've unlocked free shipping on shop items</span>}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (shopSubtotalAud / freeShipAt) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{getCartTotal()}</span>
                </div>
                {estimate ? (
                  <>
                    {estimate.commissionAud > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Service fee</span>
                        <span className="tabular-nums">{aud(estimate.commissionAud)}</span>
                      </div>
                    )}
                    {estimate.processingAud > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Payment processing</span>
                        <span className="tabular-nums">{aud(estimate.processingAud)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Shipping</span>
                      <span className="tabular-nums">{estimate.shippingAud > 0 ? aud(estimate.shippingAud) : 'Free'}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Fees &amp; shipping</span>
                    <span>{estimating ? 'Calculating…' : 'Shown at checkout'}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg text-foreground">{estimate ? 'Total' : 'Subtotal'}</span>
                  <span className="font-bold text-2xl text-foreground tabular-nums" data-testid="cart-total">
                    {estimate ? aud(estimate.totalAud) : getCartTotal()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {estimate ? <>Includes GST of {aud(estimate.includedGstAud)}. Promo codes apply at checkout.</> : 'Prices include GST.'}
                </p>
                <BnplMessage amount={estimate ? estimate.totalAud : numericTotalAud} align="center" />
              </div>

              {marketplaceInCart && gateLevel !== 'open' && (
                <p className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" data-testid="marketplace-gate-note">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {gateLevel === 'account'
                      ? <>Marketplace cards need a free CardPop account — you can sign in or create one at checkout, and your cart is kept.</>
                      : <>Marketplace orders of ${Number(settings.marketplace_identity_threshold_aud).toLocaleString('en-AU')}+ need a one-time ID check (about 2 minutes, via Stripe). You'll be asked at checkout.</>}
                  </span>
                </p>
              )}

              <Button
                className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                onClick={handleCheckout}
                disabled={isCheckingOut || cartItems.length === 0}
              >
                {isCheckingOut ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>Checkout <ArrowRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ShoppingCart;
