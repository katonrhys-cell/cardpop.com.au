import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

// eBay-style pill filter chip: a rounded trigger that opens a popover of
// options. The chip fills in when its filter is active and shows how many
// values are selected. Option rows come in two flavours — CheckRow toggles a
// value in a multi-select array, RadioRow picks exactly one value.

export const FilterChip = ({ label, count = 0, active = false, children, contentClassName = '' }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
          active || count > 0
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-border bg-background text-foreground hover:border-muted-foreground/50 hover:bg-muted/50'
        }`}
      >
        {label}
        {count > 0 && <span className="tabular-nums">({count})</span>}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className={`w-64 rounded-2xl p-2 ${contentClassName}`}>
      <div className="max-h-80 overflow-y-auto pr-1">{children}</div>
    </PopoverContent>
  </Popover>
);

// Multi-select row: `values` is the selected array, `onChange` receives the
// next array.
export const CheckRow = ({ value, label, values, onChange }) => {
  const checked = values.includes(value);
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-muted transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) =>
          onChange(v === true ? [...values, value] : values.filter((x) => x !== value))
        }
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </label>
  );
};

// Single-select row (radio semantics without a form control — a tick marks the
// current value; clicking selects it).
export const RadioRow = ({ value, label, current, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(value)}
    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-muted ${
      current === value ? 'text-primary' : 'text-foreground'
    }`}
  >
    <span className="flex h-4 w-4 items-center justify-center">
      {current === value && <Check className="h-4 w-4" aria-hidden="true" />}
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
  </button>
);

export default FilterChip;
