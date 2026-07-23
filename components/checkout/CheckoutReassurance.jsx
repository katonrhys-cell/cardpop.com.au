import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, RotateCcw, Lock } from 'lucide-react';

/*
 * Compact trust / reassurance panel shown alongside the order summary. Static —
 * no data, no network — so it renders safely anywhere in the checkout. Keeps the
 * "you're protected" signals in view right where the buyer commits to paying.
 */
const ITEMS = [
  { icon: ShieldCheck, title: 'Buyer Protection', body: 'Every order is covered — if it doesn’t arrive as described, you’re refunded.' },
  { icon: Lock, title: 'Secure Payment', body: 'Encrypted and processed by Stripe. Your card details never touch our servers.' },
  { icon: Truck, title: 'Tracked Delivery', body: 'Sent with tracking so you always know where your cards are.' },
  { icon: RotateCcw, title: 'Easy Returns', body: 'Change of mind or an issue? Our support team sorts it fast.' },
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
      Questions before you buy?{' '}
      <Link to="/trust-safety" className="font-medium text-primary hover:underline">See how you’re protected</Link>.
    </p>
  </div>
);

export default CheckoutReassurance;
