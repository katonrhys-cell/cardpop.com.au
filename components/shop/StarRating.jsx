import React from 'react';
import { Star } from 'lucide-react';

const FILL = 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]';

/** Read-only stars for a 0–5 value (halves round to the nearest whole star). */
const StarRating = ({ value = 0, size = 'w-4 h-4', className = '' }) => {
  const filled = Math.round(Number(value) || 0);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${Number(value).toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden="true" className={`${size} ${i <= filled ? FILL : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  );
};

export default StarRating;
