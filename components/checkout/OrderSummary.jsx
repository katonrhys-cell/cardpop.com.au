import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toCdnUrl } from '@/utils/imageUrl.js';
import BnplMessage from '@/components/BnplMessage.jsx';
import PreorderNotice from '@/components/shop/PreorderNotice.jsx';

const LineItem = ({ label, value, bold }) => (
  <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-base' : 'text-muted-foreground'}`}>
    <span>{label}</span>
    <span className={bold ? '' : 'text-foreground'}>${Number(value ?? 0).toFixed(2)}</span>
  </div>
);

const Pending = () => <span className="inline-block h-4 w-14 animate-pulse rounded bg-muted align-middle" aria-label="Calculating" />;

// `pricingState`: 'ready' shows the server's figures; 'loading' shows
// placeholders for everything the server owns (fees, shipping, total) so the
// buyer never reads a fee-less subtotal or a placeholder "Free" shipping as the
// real amount; 'error' shows a dash and the caller's message explains why.
const OrderSummary = ({ cartItems = [], hasPreorder = false, subtotal = 0, serviceFee = 0, processingFee = 0, gst = 0, gstIncluded = 0, shipping = 0, discount = 0, total = 0, pricingState = 'ready', onEditCart, onNext }) => {
  const ready = pricingState === 'ready';
  const pendingValue = pricingState === 'loading' ? <Pending /> : <span className="text-muted-foreground">—</span>;
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
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium">{item.name ?? 'Card'}</span>
                    {item.preorderEta && <PreorderNotice variant="inline" eta={item.preorderEta} className="mt-0.5" />}
                  </span>
                  <span className="text-muted-foreground">${Number(item.price ?? 0).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          {hasPreorder && (
            // Paid in full now like any order; the estimate above is per item.
            <p className="rounded-lg border border-brand-red/30 bg-brand-red/5 p-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">This order includes pre-order items.</span>{' '}
              You pay for them now and we dispatch them as soon as stock arrives (estimates shown above).
              If a pre-order can&apos;t be supplied, it&apos;s refunded in full.
            </p>
          )}
          <Separator />
          <div className="space-y-1.5">
            <LineItem label="Subtotal" value={subtotal} />
            {!ready && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Fees</span>
                {pendingValue}
              </div>
            )}
            {ready && discount > 0 && <LineItem label="Discount" value={-discount} />}
            {ready && serviceFee > 0 && <LineItem label="Service fee" value={serviceFee} />}
            {/* GST added on top (marketplace listings) shows as its own line; GST
                already inside GST-inclusive shop prices shows as an "includes"
                note under the total so the figures still sum to what's charged. */}
            {ready && gst > 0 && <LineItem label="GST (10%)" value={gst} />}
            {/* Covers the card-processing cost on this order. Its own line
                rather than folded into the service fee, so the buyer can see
                what each charge is for. */}
            {ready && processingFee > 0 && <LineItem label="Payment processing" value={processingFee} />}
            {/* Shipping always shows so buyers see the cost (or that it's free)
                on every order — $15 flat on CardPop Shop items, free from $100. */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Shipping</span>
              <span className="text-foreground">
                {!ready ? pendingValue : shipping > 0 ? (
                  `$${Number(shipping).toFixed(2)}`
                ) : (
                  'Free'
                )}
              </span>
            </div>
            <Separator />
            {ready ? (
              <LineItem label="Total (AUD)" value={total} bold />
            ) : (
              <div className="flex justify-between text-base font-semibold">
                <span>Total (AUD)</span>
                {pendingValue}
              </div>
            )}
            {ready && gstIncluded > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                Includes GST of ${Number(gstIncluded).toFixed(2)}
              </p>
            )}
            {ready && <BnplMessage amount={total} align="center" className="pt-1.5" />}
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
