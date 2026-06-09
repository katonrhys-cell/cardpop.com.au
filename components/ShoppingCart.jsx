
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, X, Plus, Minus, Loader2, ArrowRight, PackageOpen } from 'lucide-react';
import { useCart } from '@/hooks/useCart.jsx';
import { initializeCheckout, formatCurrency } from '@/api/EcommerceApi.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

const resolveImg = (path) => {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from('vault-images').getPublicUrl(path).data.publicUrl;
};

  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, getCartTotal } = useCart();
  const { currentUser } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    
    setIsCheckingOut(true);
    try {
      const items = cartItems.map(item => ({
        variant_id: item.variant?.id || item.product.id,
        quantity: item.quantity
      }));

      const customer = currentUser ? {
        external_id: currentUser.id,
        email: currentUser.email
      } : undefined;

      const response = await initializeCheckout({
        items,
        successUrl: `${window.location.origin}/checkout-success`,
        cancelUrl: `${window.location.origin}/shop`,
        customer
      });

      if (response?.url) {
        window.location.href = response.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to initiate checkout. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

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

                  // Build structured card label: year · name · set · grade
                  const p = item.product;
                  const year = p.year || p.card_year || null;
                  const set = p.set || p.card_set || p.era || p.collection || null;
                  const gradingCompany = p.grading_company || p.gradingCompany || null;
                  const grade = p.grade || null;
                  const gradeLabel = gradingCompany && grade && gradingCompany !== 'raw'
                    ? `${gradingCompany.toUpperCase()} ${grade}`
                    : (grade ? `Grade ${grade}` : null);

                  return (
                    <div key={itemId} className="flex gap-4 group">
                      <div className="w-20 h-24 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
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
                      </div>

                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            {year && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{year}</p>}
                            <h4 className="font-bold text-foreground line-clamp-2 leading-tight">
                              {p.title || p.name}
                            </h4>
                            {set && <p className="text-xs text-muted-foreground mt-0.5">{set}</p>}
                            {gradeLabel && <p className="text-xs font-semibold text-primary mt-0.5">{gradeLabel}</p>}
                            {!year && !set && !gradeLabel && item.variant?.title && item.variant.title !== 'Default Title' && (
                              <p className="text-sm text-muted-foreground mt-1">{item.variant.title}</p>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2 shrink-0"
                            onClick={() => removeFromCart(itemId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center border border-border rounded-lg bg-background">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-none rounded-l-lg"
                              onClick={() => updateQuantity(itemId, item.quantity - 1)}
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
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
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
                  <span>Shipping & Taxes</span>
                  <span>Calculated at checkout</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg text-foreground">Total</span>
                  <span className="font-bold text-2xl text-foreground tabular-nums">{getCartTotal()}</span>
                </div>
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
