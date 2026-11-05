import React from 'react';

/*
 * Stripe's app icon — the blurple tile with the white slanted panel — drawn
 * inline so it costs no request and stays sharp at any size. Third-party brand
 * colour, like the card marks in PaymentMarks.jsx; it is not a CardPop accent.
 * Decorative: always render the word "Stripe" beside it for screen readers.
 */
export default function StripeMark({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="112" fill="#533AFD" />
      <path fill="#fff" d="M140 188 373 140v185l-233 47z" />
    </svg>
  );
}
