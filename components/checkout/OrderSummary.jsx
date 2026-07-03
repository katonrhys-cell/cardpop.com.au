import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const LineItem = ({ label, value, bold }) => (
  <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-base' : 'text-muted-foreground'}`}>
    <span>{label}</span>
    <span className={bold ? '' : 'text-foreground'}>${Number(value ?? 0).toFixed(2)}</span>
  </div>
);

const OrderSummary = ({ cartItems = [], subtotal = 0, tax = 0, shipping = null, discount = 0, total = 0, onEditCart, onNext }) => {
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
                    <img src={item.image} alt={item.name} className="h-10 w-10 rounded object-cover border border-border" />
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
            {tax > 0 && <LineItem label="Fees & GST" value={tax} />}
            {shipping != null && (
              shipping > 0
                ? <LineItem label="Shipping" value={shipping} />
                : (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Shipping</span>
                    <span className="font-semibold text-emerald-600">FREE</span>
                  </div>
                )
            )}
            <Separator />
            <LineItem label="Total (AUD, inc. GST)" value={total} bold />
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
