import React from 'react';
import { Star, X } from 'lucide-react';

// Half-star input for the admin scorecard: each star is two invisible halves,
// so a click on the left half of star 4 gives 3.5 and the right half gives 4.
// Keyboard: each half is a real button, so Tab + Enter works; the group reads
// as a radiogroup to screen readers.
const FILL = 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]';
const EMPTY = 'text-muted-foreground/30';

const StarInput = ({ value, onChange, label, size = 'w-7 h-7', allowClear = true }) => {
  const v = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = v >= i;
        const half = !full && v >= i - 0.5;
        return (
          <span key={i} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} ${full ? FILL : EMPTY} pointer-events-none`} aria-hidden="true" />
            {half && (
              <span className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: '50%' }} aria-hidden="true">
                <Star className={`${size} ${FILL}`} />
              </span>
            )}
            <button
              type="button"
              role="radio"
              aria-checked={v === i - 0.5}
              aria-label={`${i - 0.5} stars`}
              onClick={() => onChange(i - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2 rounded-l focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
            />
            <button
              type="button"
              role="radio"
              aria-checked={v === i}
              aria-label={`${i} stars`}
              onClick={() => onChange(i)}
              className="absolute inset-y-0 right-0 w-1/2 rounded-r focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
            />
          </span>
        );
      })}
      <span className="ml-2 w-8 text-sm font-bold tabular-nums text-foreground">{v ? String(v).replace(/\.0$/, '') : '–'}</span>
      {allowClear && v > 0 && (
        <button type="button" onClick={() => onChange(null)} aria-label={`Clear ${label || 'rating'}`} className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default StarInput;
