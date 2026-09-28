import React, { useMemo } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FACETS, facetCounts } from '@/utils/shopFacets.js';

const chipClass = (selected, disabled) => [
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
  selected
    ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30'
    : 'border-border bg-card text-foreground hover:border-primary/50',
  disabled ? 'opacity-40 cursor-not-allowed hover:border-border' : '',
].join(' ');

const rowClass = (selected, disabled) => [
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
  selected ? 'bg-primary/5 font-semibold text-foreground' : 'text-foreground hover:bg-muted',
  disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : '',
].join(' ');

const Swatch = ({ option }) => (
  <span
    className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
    style={{ backgroundColor: option.hex || option.value }}
    aria-hidden="true"
  />
);

// The option buttons of one facet. `list` renders them as dropdown rows (the
// filter bar), otherwise as wrapping chips (the `plain` sidebar variant).
const FacetOptions = ({ facetKey, options, counts, value, onChange, list = false }) => {
  const def = FACETS[facetKey];
  const cls = list ? rowClass : chipClass;
  return (
    <div
      role="radiogroup"
      aria-label={`Filter by ${def.label.toLowerCase()}`}
      className={list ? 'flex flex-col gap-0.5' : 'flex flex-wrap gap-2'}
    >
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange('')} className={cls(!value, false)}>
        {list ? <span className="flex-1">All</span> : 'All'}
        {list && !value && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
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
            className={cls(selected, disabled)}
          >
            {def.swatch && <Swatch option={o} />}
            {list ? <span className="flex-1 truncate">{o.label}</span> : o.label}
            <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
            {selected && <Check className={list ? 'h-4 w-4 text-primary' : 'h-3.5 w-3.5 text-primary'} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
};

// One facet as a compact dropdown button — its label shows the current choice
// so the bar doubles as the "active filters" summary.
const FacetDropdown = ({ facetKey, options, counts, value, onChange }) => {
  const def = FACETS[facetKey];
  const current = value ? options.find((o) => o.value === value) : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
            current
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border bg-card text-foreground hover:border-primary/50'
          }`}
        >
          {current && def.swatch && <Swatch option={current} />}
          {def.label}
          {current && <span className="max-w-[9rem] truncate font-semibold text-primary">: {current.label}</span>}
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <div className="max-h-80 overflow-y-auto overscroll-contain">
          <FacetOptions
            facetKey={facetKey}
            options={options}
            counts={counts}
            value={value}
            onChange={onChange}
            list
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Filters for a shop grid — driven by useShopFacets. Renders only the facets
 * the products actually vary on, as a single row of dropdowns so the grid
 * starts right below it instead of under a wall of chips. Counts are
 * cross-filtered (each group respects the other selections) and options with
 * no matches are disabled rather than hidden so the range stays visible.
 * `plain` renders the facets as stacked chip groups with no chrome or Clear
 * link, for pages that nest it in their own filter sidebar.
 */
const ShopFilterPanel = ({ options, rows, selection, onChange, onClear, className = '', plain = false }) => {
  const keys = Object.keys(options || {});
  const activeCount = Object.keys(selection || {}).length;

  const counts = useMemo(
    () => Object.fromEntries(Object.keys(options || {}).map((k) => [k, facetCounts(rows, selection, k)])),
    [rows, selection, options],
  );

  if (keys.length === 0) return null;

  if (plain) {
    return (
      <div className={`space-y-4 ${className}`}>
        {keys.map((key) => (
          <div key={key}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{FACETS[key].label}</h3>
            <FacetOptions
              facetKey={key}
              options={options[key]}
              counts={counts[key]}
              value={selection[key] || ''}
              onChange={(v) => onChange(key, v)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`mb-6 flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto sm:overflow-visible scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}
    >
      {keys.map((key) => (
        <FacetDropdown
          key={key}
          facetKey={key}
          options={options[key]}
          counts={counts[key]}
          value={selection[key] || ''}
          onChange={(v) => onChange(key, v)}
        />
      ))}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 shrink-0 items-center gap-1 px-2 text-sm font-medium text-primary hover:underline"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  );
};

export default ShopFilterPanel;
