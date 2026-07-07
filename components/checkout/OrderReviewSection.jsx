import React from 'react';
import { MapPin, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const AddressBlock = ({ data = {} }) => (
  <div className="text-sm space-y-0.5 text-muted-foreground">
    <p className="font-medium text-foreground">{[data.firstName, data.lastName].filter(Boolean).join(' ')}</p>
    <p>{data.address}</p>
    <p>{[data.suburb, data.state, data.postcode].filter(Boolean).join(' ')}</p>
  </div>
);

// Read-only recap shown above the inline Stripe payment form on the final step.
// Payment details themselves are collected by Stripe's embedded form, so this
// component intentionally has no pay button of its own.
const OrderReviewSection = ({
  shippingData,
  billingData,
  sameAsShipping,
  items = [],
  subtotal = 0,
  tax = 0,
  discount = 0,
  total = 0,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Shipping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AddressBlock data={shippingData} />
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sameAsShipping ? (
              <p className="text-sm text-muted-foreground">Same as shipping address</p>
            ) : (
              <AddressBlock data={billingData} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id ?? i} className="flex items-center gap-3 text-sm">
              {item.image && (
                <img src={item.image} alt={item.name} className="h-10 w-10 rounded object-cover border border-border" />
              )}
              <span className="flex-1">{item.name ?? 'Card'}</span>
              <span className="text-muted-foreground">${Number(item.price ?? 0).toFixed(2)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span><span>${Number(subtotal).toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span><span>-${Number(discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tax (GST 10%)</span><span>${Number(tax).toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total (AUD)</span><span>${Number(total).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderReviewSection;
