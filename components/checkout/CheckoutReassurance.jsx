import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, RotateCcw, Lock } from 'lucide-react';
import { MARKETPLACE_PROTECTION, SHOP_PROTECTION, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

/*
 * Compact trust / reassurance panel shown alongside the order summary. Static —
 * no data, no network — so it renders safely anywhere in the checkout. Every
 * promise here is read from utils/buyerProtectionPolicy.js, so it says exactly
 * what the Returns page and the refund code do (it used to offer change-of-mind
 * returns the marketplace excludes).
 */
const ITEMS = [
  { icon: ShieldCheck, title: MARKETPLACE_PROTECTION.name, body: `${PROTECTION_COPY.marketplaceOneLine} Report it within ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days of delivery.` },
  { icon: Lock, title: 'Secure payment', body: 'Encrypted and processed by Stripe. Your card details never touch our servers.' },
  { icon: Truck, title: 'Tracked delivery', body: 'Shop orders ship tracked; marketplace sellers post within a week or you can report it.' },
  { icon: RotateCcw, title: 'Shop returns', body: `${SHOP_PROTECTION.windowDays} days from delivery on CardPop Shop products, change of mind included. Marketplace sales are binding.` },
];

const CheckoutReassurance = () => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <ul className="space-y-4">
      {ITEMS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="leading-snug">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ul>
    <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
      <Link to="/returns" className="font-medium text-primary hover:underline">Returns &amp; refunds</Link>
      {' · '}
      <Link to="/shipping" className="font-medium text-primary hover:underline">Shipping</Link>
      {' · '}
      <Link to="/trust-safety" className="font-medium text-primary hover:underline">How you’re protected</Link>
    </p>
  </div>
);

export default CheckoutReassurance;
