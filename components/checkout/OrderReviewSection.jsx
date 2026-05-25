import React from 'react';
import { MapPin, CreditCard, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const AddressBlock = ({ data = {} }) => (
  <div className="text-sm space-y-0.5 text-muted-foreground">
    <p className="font-medium text-foreground">{data.firstName} {data.lastName}</p>
    <p>{data.address}</p>
    <p>{data.suburb} {data.state} {data.postcode}</p>
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
  total = 0,
  onConfirm,
  isSubmitting,
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
          <Badge variant="outline" className="capitalize">{paymentMethod ?? '—'}</Badge>
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
            <div key={item.id ?? i} className="flex justify-between text-sm">
              <span>{item.name ?? 'Card'}</span>
              <span className="text-muted-foreground">${Number(item.price ?? 0).toFixed(2)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tax (GST)</span><span>${Number(tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total (AUD)</span><span>${Number(total).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderReviewSection;
