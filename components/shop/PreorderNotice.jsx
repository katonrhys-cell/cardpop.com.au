import React from 'react';
import { CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * The "Pre-order" label every shop surface uses, so the badge, the wording and
 * the estimate read the same on a grid card, a product page, the cart drawer
 * and checkout.
 *
 *   <PreorderBadge />                        — the bare badge
 *   <PreorderNotice eta="Ships in 4–6 weeks" />            — badge-less callout
 *   <PreorderNotice eta=… variant="inline" />              — one short line
 *
 * The estimate is the admin's free text from shop_products.preorder_eta (read
 * through preorderEta() in utils/shopStock.js, which supplies a fallback).
 */
export function PreorderBadge({ className }) {
  return (
    // Outlined, so it never reads as the solid-red "Sold out" ribbon.
    <Badge className={cn('bg-brand-white text-brand-red hover:bg-brand-white border border-brand-red font-extrabold uppercase tracking-wider', className)}>
      Pre-order
    </Badge>
  );
}

export default function PreorderNotice({ eta, variant = 'callout', className }) {
  if (variant === 'inline') {
    return (
      <p className={cn('flex items-center gap-1.5 text-xs font-semibold text-brand-red', className)}>
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Pre-order · {eta}</span>
      </p>
    );
  }
  return (
    <div
      className={cn('flex items-start gap-3 rounded-xl border border-brand-red/30 bg-brand-red/5 p-3 text-sm', className)}
      role="note"
    >
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">
          Pre-order — estimated dispatch: <span className="text-brand-red">{eta}</span>
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Order and pay now to secure yours. We dispatch it as soon as stock arrives, and if it
          can&apos;t be supplied you&apos;re refunded in full.
        </p>
      </div>
    </div>
  );
}
