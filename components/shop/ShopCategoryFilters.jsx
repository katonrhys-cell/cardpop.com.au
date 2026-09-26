import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { filterFacetRows, typeKey } from '@/utils/shopFacets.js';

const chipClass = (selected, disabled) => [
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
  selected
    ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30'
    : 'border-border bg-card text-foreground hover:border-primary/50',
  disabled ? 'opacity-40 cursor-not-allowed hover:border-border' : '',
].join(' ');

const Count = ({ n }) => <span className="text-xs text-muted-foreground">{n}</span>;

/**
 * Type + colour chip filters above a shop category grid. Each group renders
 * only when the category offers it (see utils/shopFacets.js). Counts are
 * cross-filtered: type counts respect the chosen colour and vice versa, and an
 * option with no matches is disabled rather than hidden so the range stays
 * visible.
 */
const ShopCategoryFilters = ({
  typeOptions, colourOptions, facetRows, type, colour, onTypeChange, onColourChange, onClear,
}) => {
  const typeCounts = useMemo(() => {
    const counts = new Map();
    for (const p of filterFacetRows(facetRows, { colour })) {
      counts.set(typeKey(p), (counts.get(typeKey(p)) || 0) + 1);
    }
    return counts;
  }, [facetRows, colour]);

  const colourCounts = useMemo(() => {
    const counts = new Map();
    for (const p of filterFacetRows(facetRows, { type })) {
      const key = String(p.colour || '').trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [facetRows, type]);

  if (typeOptions.length === 0 && colourOptions.length === 0) return null;

  return (
    <div className="mb-8 space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      {typeOptions.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</h2>
          <div role="radiogroup" aria-label="Filter by type" className="flex flex-wrap gap-2">
            <button type="button" role="radio" aria-checked={!type} onClick={() => onTypeChange('')} className={chipClass(!type, false)}>
              All types
            </button>
            {typeOptions.map((o) => {
              const n = typeCounts.get(o.value) || 0;
              const selected = o.value === type;
              const disabled = n === 0 && !selected;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onTypeChange(selected ? '' : o.value)}
                  className={chipClass(selected, disabled)}
                >
                  {o.label}
                  <Count n={n} />
                  {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {colourOptions.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Colour</h2>
          <div role="radiogroup" aria-label="Filter by colour" className="flex flex-wrap gap-2">
            <button type="button" role="radio" aria-checked={!colour} onClick={() => onColourChange('')} className={chipClass(!colour, false)}>
              All colours
            </button>
            {colourOptions.map((o) => {
              const n = colourCounts.get(o.value) || 0;
              const selected = o.value === colour;
              const disabled = n === 0 && !selected;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onColourChange(selected ? '' : o.value)}
                  className={chipClass(selected, disabled)}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: o.hex || o.value }}
                    aria-hidden="true"
                  />
                  {o.label}
                  <Count n={n} />
                  {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(type || colour) && (
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
  );
};

export default ShopCategoryFilters;
