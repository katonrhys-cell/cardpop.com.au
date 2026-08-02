import React from 'react';
import { ArrowRightLeft, ShoppingBag, Tag } from 'lucide-react';

/**
 * Account-wide notice announcing that peer-to-peer (card-for-card) trading is
 * still being built and is due toward the end of 2026 — while reassuring
 * members that buying and selling work as normal in the meantime.
 *
 * Shown on the account dashboard so every logged-in member sees it.
 */
const P2PTradingNotice = () => (
  <div className="rounded-2xl border border-border bg-muted/30 p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red/10">
        <ArrowRightLeft className="h-5 w-5 text-brand-red" />
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-lg font-bold text-foreground">
            Peer-to-peer trading is on the way
          </p>
          <span className="rounded-full bg-brand-red/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-red">
            Coming late 2026
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          We're building card-for-card peer-to-peer trading and expect to launch it
          toward the end of 2026. In the meantime, nothing changes for you:
          keep listing your cards for sale and buying as normal — the marketplace
          is fully open for business today.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-sm font-medium text-foreground">
          <span className="flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-brand-red" /> List cards for sale now
          </span>
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-brand-red" /> Buy &amp; sell as usual
          </span>
        </div>
      </div>
    </div>
  </div>
);

export default P2PTradingNotice;
