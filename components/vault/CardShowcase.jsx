import React, { useEffect, useRef, useState } from 'react';
import CardImage from '@/components/CardImage.jsx';
import { normalizeStyle, getStyleByKey } from '@/lib/displayStyles.js';
import './cardShowcase.css';

/**
 * CardShowcase — the Vault Card Showcase Engine.
 *
 * Renders a card image inside one of the display-style "frames" defined in the
 * registry (lib/displayStyles.js) and cardShowcase.css. Drop it into an
 * existing positioned, aspect-ratio container (it fills with `absolute inset-0`)
 * exactly where a plain <CardImage> would go; badges/overlays remain siblings
 * layered on top.
 *
 * Performance: CSS keyframe animations only run while the card is on screen
 * (an IntersectionObserver toggles `.is-visible`), and the heavier pointer
 * tracking for the holographic style only attaches for that style and only for
 * mouse input — touch scrolling is never intercepted. Reduced-motion users get
 * the static framing with no animation (handled in CSS).
 */
const CardShowcase = ({
  src,
  srcSet,
  sizes,
  fallbackSrc,
  alt = '',
  width,
  height,
  loading = 'lazy',
  displayStyle = 'classic',
  className = '',
}) => {
  const styleKey = normalizeStyle(displayStyle);
  const def = getStyleByKey(styleKey);
  const needsObserver = def?.animated || def?.interactive;

  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(!needsObserver);
  const [pointing, setPointing] = useState(false);

  // Play animations only while on screen.
  useEffect(() => {
    if (!needsObserver) { setVisible(true); return; }
    const node = stageRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [needsObserver]);

  // Holographic: track the mouse to drive shine + tilt via CSS variables.
  const interactive = def?.interactive;
  const handleMouseMove = (e) => {
    if (!interactive) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0..1
    const y = (e.clientY - rect.top) / rect.height;   // 0..1
    card.style.setProperty('--cs-rx', `${(0.5 - y) * 8}deg`);
    card.style.setProperty('--cs-ry', `${(x - 0.5) * 8}deg`);
    card.style.setProperty('--cs-px', `${x * 100}%`);
    if (!pointing) setPointing(true);
  };
  const handleMouseLeave = () => {
    if (!interactive) return;
    const card = cardRef.current;
    if (card) {
      card.style.removeProperty('--cs-rx');
      card.style.removeProperty('--cs-ry');
      card.style.removeProperty('--cs-px');
    }
    setPointing(false);
  };

  const stageClass = [
    'cardshowcase',
    `cardshowcase--${styleKey}`,
    visible ? 'is-visible' : '',
    pointing ? 'is-pointing' : '',
    className,
  ].filter(Boolean).join(' ');

  // Slab provides its own internal padding; the others inset the photo a touch.
  const imgPad = styleKey === 'slab' ? '' : 'p-2';

  return (
    <div
      ref={stageRef}
      className={stageClass}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      <div className="cardshowcase__stage">
        <div ref={cardRef} className="cardshowcase__card">
          <CardImage
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            fallbackSrc={fallbackSrc}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            imgClassName={`w-full h-full object-contain ${imgPad}`}
          />
          {styleKey === 'holographic' && <div className="cardshowcase__holo" aria-hidden="true" />}
        </div>

        {/* Per-style decorative layers (purely visual). */}
        {(def?.key === 'stand' || def?.key === 'floating' || def?.key === 'glass' || def?.key === 'rotating') && (
          <div className="cardshowcase__shadow" aria-hidden="true" />
        )}
        {(styleKey === 'stand' || styleKey === 'slab') && (
          <div className="cardshowcase__prop" aria-hidden="true" />
        )}
        {styleKey === 'glass' && <div className="cardshowcase__glass" aria-hidden="true" />}
      </div>
    </div>
  );
};

export default CardShowcase;
