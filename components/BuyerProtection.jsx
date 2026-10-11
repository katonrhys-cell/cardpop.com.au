import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, PackageCheck, BadgeCheck } from 'lucide-react';
import { MARKETPLACE_PROTECTION, SHOP_PROTECTION, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

/**
 * The protection promise, stated from utils/buyerProtectionPolicy.js so it can
 * never disagree with the Returns page or the refund code.
 *
 * Props:
 *   compact  one line for the buy box / cart (default: the full card)
 *   kind     'marketplace' (a collector's card) | 'shop' (CardPop's own stock)
 */
const BuyerProtection = ({ compact = false, kind = 'marketplace', className = '' }) => {
  const shop = kind === 'shop';

  if (compact) {
    return (
      <p className={`flex items-start gap-2 text-sm text-muted-foreground ${className}`}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
        <span>
          <span className="font-semibold text-foreground">{shop ? `${SHOP_PROTECTION.windowDays}-day returns` : MARKETPLACE_PROTECTION.name}</span>
          {' · '}
          {shop ? 'Change of mind welcome, unused and in its packaging.' : PROTECTION_COPY.marketplaceOneLine}{' '}
          <Link to="/returns" className="font-medium text-primary hover:underline">Details</Link>
        </span>
      </p>
    );
  }

  const points = shop
    ? [
        { icon: Clock, title: `${SHOP_PROTECTION.windowDays}-day returns`, body: 'From the day your parcel is delivered, for any reason.' },
        { icon: PackageCheck, title: 'No restocking fee', body: 'Post it back unused and in its packaging — refunded in full.' },
        { icon: BadgeCheck, title: 'Sold by CardPop', body: 'New stock, dispatched and backed by us.' },
      ]
    : [
        { icon: ShieldCheck, title: 'Full refund', body: 'Not as described, damaged, counterfeit or never arrived — every dollar back, fees included.' },
        { icon: Clock, title: `${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days from delivery`, body: `Report a problem within ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days of the card arriving; unsent orders can be reported after ${MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days.` },
        { icon: BadgeCheck, title: 'Verified sellers', body: 'Every seller has passed a government-ID check with Stripe Identity.' },
      ];

  return (
    <div className={`rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900/50 dark:bg-green-950/30 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600">
          <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-green-900 dark:text-green-100">{shop ? 'CardPop Shop returns' : MARKETPLACE_PROTECTION.name}</h3>
          <p className="text-sm text-green-700 dark:text-green-300">{shop ? PROTECTION_COPY.shopOneLine : PROTECTION_COPY.marketplaceOneLine}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <div>
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">{title}</h4>
              <p className="text-xs text-green-700 dark:text-green-300">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {!shop && (
        <p className="text-xs text-green-700 dark:text-green-300">{PROTECTION_COPY.marketplaceNoChangeOfMind}</p>
      )}
      <p className="mt-1 text-xs">
        <Link to="/returns" className="font-semibold text-green-800 underline-offset-2 hover:underline dark:text-green-200">Read the full policy</Link>
      </p>
    </div>
  );
};

export default BuyerProtection;
