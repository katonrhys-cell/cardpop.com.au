import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toCdnUrl } from '@/utils/imageUrl.js';
import BnplMessage from '@/components/BnplMessage.jsx';

const LineItem = ({ label, value, bold }) => (
  <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-base' : 'text-muted-foreground'}`}>
    <span>{label}</span>
    <span className={bold ? '' : 'text-foreground'}>${Number(value ?? 0).toFixed(2)}</span>
  </div>
);

const OrderSummary = ({ cartItems = [], subtotal = 0, serviceFee = 0, processingFee = 0, gst = 0, gstIncluded = 0, shipping = 0, shippingWaived = 0, discount = 0, total = 0, onEditCart, onNext }) => {
  return (
    <div className="space-y-4">
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cartItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Your cart is empty.</p>
          ) : (
            <ul className="space-y-2">
              {cartItems.map((item, i) => (
                <li key={item.id ?? i} className="flex items-center gap-3 text-sm">
                  {item.image && (
                    <img src={toCdnUrl(item.image)} alt={item.name} className="h-10 w-10 rounded object-cover border border-border" />
                  )}
                  <span className="flex-1 font-medium">{item.name ?? 'Card'}</span>
                  <span className="text-muted-foreground">${Number(item.price ?? 0).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <div className="space-y-1.5">
            <LineItem label="Subtotal" value={subtotal} />
            {discount > 0 && <LineItem label="Discount" value={-discount} />}
            {serviceFee > 0 && <LineItem label="Service fee" value={serviceFee} />}
            {/* GST added on top (marketplace listings) shows as its own line; GST
                already inside GST-inclusive shop prices shows as an "includes"
                note under the total so the figures still sum to what's charged. */}
            {gst > 0 && <LineItem label="GST (10%)" value={gst} />}
            {/* Covers the card-processing cost on this order. Its own line
                rather than folded into the service fee, so the buyer can see
                what each charge is for. */}
            {processingFee > 0 && <LineItem label="Payment processing" value={processingFee} />}
            {/* Shipping always shows so buyers see the cost (or that it's free)
                on every order — $10 flat on CardPop Shop items, free over $50.
                `shippingWaived` is the fee a promo code's free-shipping perk
                took off, struck through so the saving is visible. */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Shipping</span>
              <span className="text-foreground">
                {shipping > 0 ? (
                  `$${Number(shipping).toFixed(2)}`
                ) : shippingWaived > 0 ? (
                  <>
                    <span className="line-through text-muted-foreground mr-1.5">${Number(shippingWaived).toFixed(2)}</span>
                    <span className="text-green-600 font-semibold">Free</span>
                  </>
                ) : (
                  'Free'
                )}
              </span>
            </div>
            <Separator />
            <LineItem label="Total (AUD)" value={total} bold />
            {gstIncluded > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                Includes GST of ${Number(gstIncluded).toFixed(2)}
              </p>
            )}
            <BnplMessage amount={total} align="center" className="pt-1.5" />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        {onEditCart && <Button variant="outline" onClick={onEditCart}>Edit Cart</Button>}
        {onNext && (
          <Button onClick={onNext} className="ml-auto">
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderSummary;
