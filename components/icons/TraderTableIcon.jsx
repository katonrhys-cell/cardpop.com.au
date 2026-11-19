import React from 'react';

// A little table — the "Apply for a Trader Table" button on event pages.
// Drawn on lucide's 24px grid with a 2px stroke in currentColor so it sits
// beside lucide icons and follows the text colour in light and dark themes.
const TraderTableIcon = ({ className = 'w-4 h-4', ...props }) => (
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
    {/* Tabletop */}
    <rect x="2" y="7" width="20" height="4" rx="1" />
    {/* Legs */}
    <path d="M5 11v9" />
    <path d="M19 11v9" />
    {/* Stretcher between the legs */}
    <path d="M5 16h14" />
  </svg>
);

export default TraderTableIcon;
