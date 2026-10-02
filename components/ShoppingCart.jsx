
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
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{getCartTotal()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-sm">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <p className="text-xs text-muted-foreground">Prices include GST.</p>
                <Separator className="my-2" />
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg text-foreground">Total</span>
                  <span className="font-bold text-2xl text-foreground tabular-nums">{getCartTotal()}</span>
                </div>
                <BnplMessage amount={numericTotalAud} align="center" />
              </div>

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
