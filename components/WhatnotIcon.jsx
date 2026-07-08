import React from 'react';

// Canonical Whatnot logo mark used across the whole site: a black rounded
// square with the yellow zigzag "W". Self-contained (its own colors and
// background) so it renders identically on any surface — header dropdown,
// community pages, seller store pills, etc. Size it with `className`.
const WhatnotIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
    <rect width="32" height="32" rx="8" fill="#000000" />
    <path
      d="M5 9l4.5 14 4-9.5 2.5 5.5 2.5-5.5 4 9.5L27 9"
      stroke="#FFDF00"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default WhatnotIcon;
