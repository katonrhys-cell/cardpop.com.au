import React from 'react';
import { MapPin, CreditCard, Package, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const AddressBlock = ({ data = {} }) => (
  <div className="text-sm space-y-0.5 text-muted-foreground">
    <p className="font-medium text-foreground">{[data.firstName, data.lastName].filter(Boolean).join(' ')}</p>
    <p>{data.address}</p>
    <p>{[data.suburb, data.state, data.postcode].filter(Boolean).join(' ')}</p>
  </div>
);

const OrderReviewSection = ({
  shippingData,
  billingData,
  sameAsShipping,
  paymentMethod,
  items = [],
  subtotal = 0,
  tax = 0,
  shipping = null,
  discount = 0,
  total = 0,
  processing = false,
  onConfirm,
  onBack,
}) => {
  return (
    <div className="space-y-4">
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddressBlock data={shippingData} />
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Billing Address
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

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="capitalize">
            {paymentMethod === 'card' ? 'Credit / Debit Card' : (paymentMethod ?? '—')}
          </Badge>
        </CardContent>
      </Card>

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
          {tax > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Fees & GST</span><span>${Number(tax).toFixed(2)}</span>
            </div>
          )}
          {shipping != null && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Shipping</span>
              {shipping > 0
                ? <span>${Number(shipping).toFixed(2)}</span>
                : <span className="font-semibold text-emerald-600">FREE</span>}
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total (AUD, inc. GST)</span><span>${Number(total).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} disabled={processing}>
            Back
          </Button>
        )}
        {onConfirm && (
          <Button onClick={onConfirm} disabled={processing} className="ml-auto">
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
            ) : (
              'Confirm & Pay'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderReviewSection;
