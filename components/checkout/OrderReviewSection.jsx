import React from 'react';
import { MapPin, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toCdnUrl } from '@/utils/imageUrl.js';

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
  serviceFee = 0,
  processingFee = 0,
  gst = 0,
  gstIncluded = 0,
  shipping = 0,
  // Fee a promo code's free-shipping perk took off — shown struck through so
  // the final review states the saving rather than an unexplained "Free".
  shippingWaived = 0,
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
            {billingData?.isBusiness && billingData?.abn && (
              <div className="mt-2 border-t border-border pt-2 text-sm">
                {billingData.businessName && <p className="font-medium text-foreground">{billingData.businessName}</p>}
                <p className="text-muted-foreground">ABN: {billingData.abn}</p>
              </div>
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
                <img src={toCdnUrl(item.image)} alt={item.name} className="h-10 w-10 rounded object-cover border border-border" />
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
          {serviceFee > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Service fee</span><span>${Number(serviceFee).toFixed(2)}</span>
            </div>
          )}
          {gst > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>GST (10%)</span><span>${Number(gst).toFixed(2)}</span>
            </div>
          )}
          {processingFee > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payment processing</span><span>${Number(processingFee).toFixed(2)}</span>
            </div>
          )}
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
          <div className="flex justify-between font-semibold text-base">
            <span>Total (AUD)</span><span>${Number(total).toFixed(2)}</span>
          </div>
          {gstIncluded > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              Includes GST of ${Number(gstIncluded).toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderReviewSection;
