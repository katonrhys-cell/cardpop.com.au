import React from 'react';
import { Check } from 'lucide-react';
import ColourSwatch from '@/components/shop/ColourSwatch.jsx';
import { activeVariants, variantInStock, variantLabel, variantStock } from '@/utils/shopVariants.js';

/**
 * Colour chips for a product with variants. Sold-out colours stay visible but
 * disabled so the shopper can see the range (and enquire), not just what's
 * left. Renders nothing for a product with no variants.
 *
 * Props: product (with `variants`), value (selected variant id), onChange(variant),
 * showAvailability (default true) — pass false where nothing is buyable yet
 * (e.g. Coming soon), so zero stock doesn't strike every colour through.
 */
const VariantPicker = ({ product, value, onChange, className = '', showAvailability = true }) => {
  const list = activeVariants(product);
  if (list.length === 0) return null;
  const selected = list.find((v) => v.id === value) || null;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Colour{list.length > 1 ? ` · ${list.length} options` : ''}
        </h2>
        {selected && (
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{variantLabel(selected)}</span>
            {!showAvailability ? null : variantInStock(selected)
              ? (variantStock(selected) <= 5 ? ` · only ${variantStock(selected)} left` : ' · in stock')
              : ' · sold out'}
          </span>
        )}
      </div>
      <div role="radiogroup" aria-label="Colour" className="mt-3 flex flex-wrap gap-2">
        {list.map((v) => {
          const inStock = !showAvailability || variantInStock(v);
          const isSelected = v.id === value;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${variantLabel(v)}${inStock ? '' : ' (sold out)'}`}
              onClick={() => onChange?.(v)}
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                isSelected ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30' : 'border-border bg-card text-foreground hover:border-primary/50',
                inStock ? '' : 'opacity-60 line-through decoration-muted-foreground',
              ].join(' ')}
            >
              <ColourSwatch name={v.colour} hex={v.colour_hex} />
              {variantLabel(v)}
              {isSelected && <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VariantPicker;
