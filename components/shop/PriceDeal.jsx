import React from 'react';
import { getPriceDeal, formatSaving } from '@/utils/priceDeal.js';

// The deal presentation the shop grid card (ProductCard) uses, shared with the
// product pages so a product reads identically in both places: red price,
// struck-through RRP, "You save $X (N% off RRP)" pill, and the "N% OFF" ribbon.
// All of it comes from getPriceDeal(), so a deal only shows for a real RRP.

export function DealRibbon({ price, rrp, className = '' }) {
  const deal = getPriceDeal(price, rrp);
  if (!deal) return null;
  return (
    <span
      className={`absolute top-3 left-3 z-10 inline-flex items-center rounded-md bg-brand-red px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white shadow-md ${className}`}
    >
      {deal.pct}% off
    </span>
  );
}

export default function PriceDeal({ price, rrp }) {
  const deal = getPriceDeal(price, rrp);
  const p = Number(price);
  if (!deal) {
    return (
      <span className="text-3xl font-extrabold tabular-nums text-foreground">
        ${p.toFixed(2)}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-3xl font-black tabular-nums text-brand-red leading-none" data-testid="deal-price">
          ${deal.price.toFixed(2)}
        </span>
        <span className="text-lg text-muted-foreground line-through tabular-nums" aria-label={`Was $${deal.rrp.toFixed(2)}`}>
          ${deal.rrp.toFixed(2)}
        </span>
      </div>
      <span className="inline-flex w-fit items-center rounded-md bg-brand-red/10 px-2 py-0.5 text-xs font-extrabold text-brand-red">
        You save {formatSaving(deal.saving)} ({deal.pct}% off RRP)
      </span>
    </div>
  );
}
