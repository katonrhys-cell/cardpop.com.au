import React from 'react';

// Basketball singlet icon that marks rookie cards (replaces the old trophy /
// medal emoji). Drawn in currentColor so it follows the surrounding text
// colour in both light and dark themes.
const RookieJerseyIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    {/* Sleeveless v-neck jersey outline */}
    <path d="M6 3 L8.5 3 C9.2 5.8 10.4 7.2 12 7.2 C13.6 7.2 14.8 5.8 15.5 3 L18 3 C18 5.6 18.3 7.6 19 9 L19 20 C19 20.6 18.6 21 18 21 L6 21 C5.4 21 5 20.6 5 20 L5 9 C5.7 7.6 6 5.6 6 3 Z" />
  </svg>
);

export default RookieJerseyIcon;
