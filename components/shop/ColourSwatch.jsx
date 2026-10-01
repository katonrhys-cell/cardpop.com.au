import React from 'react';
import { swatchStyle } from '@/utils/colourSwatch.js';

/**
 * The small colour dot inside a colour chip. Uses the row's hex when it has
 * one, else a palette colour for the name (see utils/colourSwatch.js), so a
 * row imported without a hex still gets its dot. Renders nothing for a colour
 * it can't place.
 */
const ColourSwatch = ({ name, hex, className = '' }) => {
  const style = swatchStyle(name, hex);
  if (!style) return null;
  return (
    <span
      className={`h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

export default ColourSwatch;
