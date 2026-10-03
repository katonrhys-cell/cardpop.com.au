import React from 'react';
import { Check } from 'lucide-react';
import { isSoldOut } from '@/utils/shopStock.js';

/**
 * "Point Size (pt)" chips for a product sold in several sizes. Each size is its
 * own product line, so choosing one opens that size's page — photos, price,
 * stock, SKU and copy all follow. Sold-out sizes stay visible (struck through)
 * so the range is clear.
 *
 * Props: options (utils/shopSizes.js sizeGroupFor), value (selected slug),
 * stock (useSizeStock map keyed by slug), onChange(option).
 */
const SizePicker = ({ options, value, stock = {}, onChange, className = '' }) => {
  if (!options || options.length < 2) return null;
  const selected = options.find((o) => o.slug === value) || null;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Point size (pt){selected ? <span className="ml-2 normal-case tracking-normal text-foreground">{selected.label}</span> : null}
        </h2>
      </div>
      <div role="radiogroup" aria-label="Point size" className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const row = stock[o.slug];
          const soldOut = row ? isSoldOut(row) : false;
          const price = row?.price_aud != null && Number(row.price_aud) > 0 ? Number(row.price_aud) : null;
          const isSelected = o.slug === value;
          return (
            <button
              key={o.slug}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${o.label}${price != null ? `, $${price.toFixed(2)}` : ''}${soldOut ? ' (sold out)' : ''}`}
              onClick={() => onChange?.(o)}
              className={[
                'flex min-w-[4.5rem] flex-col items-center rounded-xl border px-4 py-2 text-sm transition-colors',
                isSelected ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30' : 'border-border bg-card text-foreground hover:border-primary/50',
                soldOut ? 'opacity-60' : '',
              ].join(' ')}
            >
              <span className={`flex items-center gap-1 font-semibold ${soldOut ? 'line-through decoration-muted-foreground' : ''}`}>
                {o.label}
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
              </span>
              {price != null && (
                <span className="text-xs tabular-nums text-muted-foreground">${price.toFixed(2)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SizePicker;
