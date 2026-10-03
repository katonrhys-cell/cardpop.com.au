import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { binderCapacity, binderCapacitySiblings } from '@/utils/binderCapacity.js';
import { binderProductBySku } from '@/data/shopBinderProducts.js';
import { slugify } from '@/utils/shopProductUrl.js';

/**
 * "Binder capacity" chips on a binder product page — 128 | 216 on the top
 * loader binders, 160 | 360 | 480 on the Collector's Series zip binders.
 *
 * Each capacity is its own product line (own SKU, price and page), so the
 * other options are links to that line's page, carrying the chosen colour
 * across when the other line comes in it. A line with no siblings still shows
 * its single capacity, so every binder states how much it holds.
 */
const BinderCapacityPicker = ({ sku, colour, className = '' }) => {
  const current = binderCapacity(sku);
  if (!current) return null;
  const options = binderCapacitySiblings(sku)
    .map((o) => ({ ...o, product: binderProductBySku(o.sku) }))
    .filter((o) => o.product);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Binder capacity
        </h2>
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{current.slots} slots</span>
          {current.unit === 'cards' ? '' : ` · ${current.unit}`}
        </span>
      </div>
      <div role="radiogroup" aria-label="Binder capacity" className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const isSelected = o.sku === String(sku).toUpperCase();
          const carriesColour = colour
            && o.product.colours.some((c) => slugify(c.name) === slugify(colour));
          const to = `/shop/binders/${o.product.slug}${carriesColour ? `?colour=${slugify(colour)}` : ''}`;
          const chip = [
            'flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums transition-colors',
            isSelected ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30' : 'border-border bg-card text-foreground hover:border-primary/50',
          ].join(' ');
          const label = `${o.slots} slots, ${o.product.pocketsPerPage}-pocket`;
          return isSelected ? (
            <span key={o.sku} role="radio" aria-checked="true" aria-label={label} className={chip}>
              {o.slots}
              <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            </span>
          ) : (
            <Link key={o.sku} to={to} role="radio" aria-checked="false" aria-label={label} className={chip}>
              {o.slots}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BinderCapacityPicker;
