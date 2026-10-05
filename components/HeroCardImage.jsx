import React from 'react';

// Renders a homepage hero card image as a responsive <picture>: AVIF → WebP →
// JPG, each at 360 w (1×) / 720 w (2×). `sizes` is the rendered width of the
// slot — the shelf cards are 68 px and the featured card 160 px (see
// HeroCardShowcase) — so the browser picks the smallest sufficient file
// (≈15–20 KB AVIF instead of the old 326 KB JPG). A `sizes` wider than the
// slot made 2× screens fetch the 720 w files for a 160 px card, which
// PageSpeed counted as oversized image delivery.
//
// They're decorative and live in a `hidden lg:block` container, so:
//   - loading="lazy"  → phones (where the container is display:none) never fetch
//     them at all, and on desktop they don't block first paint;
//   - fetchpriority="low" → they never compete with the LCP <h1> text.
//
// `stem` is the path without size/extension, e.g. "/images/hero/lebron-james".
const HeroCardImage = ({ stem, alt, sizes = '160px' }) => (
  <picture>
    <source
      type="image/avif"
      srcSet={`${stem}-360.avif 360w, ${stem}-720.avif 720w`}
      sizes={sizes}
    />
    <source
      type="image/webp"
      srcSet={`${stem}-360.webp 360w, ${stem}-720.webp 720w`}
      sizes={sizes}
    />
    <img
      src={`${stem}-360.jpg`}
      srcSet={`${stem}-360.jpg 360w, ${stem}-720.jpg 720w`}
      sizes={sizes}
      alt={alt}
      className="absolute inset-0 w-full h-full object-contain p-1"
      draggable={false}
      width="160"
      height="224"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
  </picture>
);

export default HeroCardImage;
