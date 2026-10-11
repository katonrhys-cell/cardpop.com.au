import React from 'react';
import { Star } from 'lucide-react';

// Read-only 0–5 stars that can show a half — the shop's StarRating rounds to
// whole stars, which is fine for an average of many reviews but wrong for a
// single scorecard where "4.5" is the whole point. Same colour token as the
// shop stars so both read as one system.
const FILL = 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]';
const EMPTY = 'text-muted-foreground/30';

const HalfStars = ({ value = 0, size = 'w-4 h-4', className = '', label }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={label || `${v.toFixed(1).replace(/\.0$/, '')} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const full = v >= i;
        const half = !full && v >= i - 0.5;
        return (
          <span key={i} className={`relative inline-block ${size}`} aria-hidden="true">
            <Star className={`absolute inset-0 ${size} ${full ? FILL : EMPTY}`} />
            {half && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                <Star className={`${size} ${FILL}`} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};

export default HalfStars;
