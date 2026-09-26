import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { FACETS, facetCounts } from '@/utils/shopFacets.js';

const chipClass = (selected, disabled) => [
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
  selected
    ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30'
    : 'border-border bg-card text-foreground hover:border-primary/50',
  disabled ? 'opacity-40 cursor-not-allowed hover:border-border' : '',
].join(' ');

const FacetGroup = ({ facetKey, options, counts, value, onChange }) => {
  const def = FACETS[facetKey];
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{def.label}</h3>
      <div role="radiogroup" aria-label={`Filter by ${def.label.toLowerCase()}`} className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange('')} className={chipClass(!value, false)}>
          All
        </button>
        {options.map((o) => {
          const n = counts.get(o.value) || 0;
          const selected = o.value === value;
          const disabled = n === 0 && !selected;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? '' : o.value)}
              className={chipClass(selected, disabled)}
            >
              {def.swatch && (
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                  style={{ backgroundColor: o.hex || o.value }}
                  aria-hidden="true"
                />
              )}
              {o.label}
              <span className="text-xs text-muted-foreground">{n}</span>
              {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Chip filters above a shop grid — driven by useShopFacets. Renders only the
 * facets the products actually vary on. Counts are cross-filtered (each group
 * respects the other selections) and options with no matches are disabled
 * rather than hidden so the range stays visible. Collapsed behind a "Filters"
 * button on phones so the grid isn't pushed off-screen. `plain` drops the
 * card chrome, the phone toggle and the Clear link, for pages that nest it in
 * their own filter sidebar.
 */
const ShopFilterPanel = ({ options, rows, selection, onChange, onClear, className = '', plain = false }) => {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(options || {});
  const activeCount = Object.keys(selection || {}).length;

  const counts = useMemo(
    () => Object.fromEntries(Object.keys(options || {}).map((k) => [k, facetCounts(rows, selection, k)])),
    [rows, selection, options],
  );

  if (keys.length === 0) return null;

  return (
    <div className={`${plain ? '' : 'mb-8'} ${className}`}>
      {!plain && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="md:hidden mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}

      <div className={`${open || plain ? 'block' : 'hidden'} md:block space-y-4 ${plain ? '' : 'rounded-2xl border border-border bg-card p-4 md:p-5'}`}>
        {keys.map((key) => (
          <FacetGroup
            key={key}
            facetKey={key}
            options={options[key]}
            counts={counts[key]}
            value={selection[key] || ''}
            onChange={(v) => onChange(key, v)}
          />
        ))}

        {activeCount > 0 && !plain && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

export default ShopFilterPanel;
