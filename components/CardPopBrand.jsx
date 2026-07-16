import React from 'react';

/**
 * Inline "CardPop™" wordmark for running text — mirrors the logo lockup:
 * "Card" in foreground, "Pop" in brand red, ™ as a small raised sans-serif
 * mark (same treatment as CardPopLogo, but flowing with the surrounding
 * text instead of absolutely positioned).
 */
const CardPopBrand = ({ className = '' }) => (
  <span className={`whitespace-nowrap ${className}`}>
    <span className="text-foreground">Card</span>
    <span className="text-primary">Pop</span>
    <sup className="text-[0.65em] font-sans font-normal tracking-normal leading-none text-foreground">™</sup>
  </span>
);

export default CardPopBrand;
