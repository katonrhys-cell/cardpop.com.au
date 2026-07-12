import React from 'react';

/**
 * CardPop brand logo.
 *
 * variant="header"  — icon + "CardPop" wordmark (no subtitle)
 * variant="full"    — icon + "CardPop" + "AUSTRALIA" subtitle
 * variant="icon"    — icon mark only
 *
 * onDark=true       — forces light text; use when placed on a dark solid background
 */

const CardIcon = ({ className }) => (
  <svg viewBox="0 0 56 68" fill="none" aria-hidden="true" className={className}>
    {/* Clip tab */}
    <rect x="17" y="0.5" width="22" height="11" rx="4" stroke="currentColor" strokeWidth="2.5"/>
    <rect x="20.5" y="3" width="15" height="5" rx="2" fill="currentColor" opacity="0.22"/>
    {/* Main body */}
    <rect x="1.5" y="9" width="53" height="58" rx="6" stroke="currentColor" strokeWidth="2.5"/>
    {/* Inner holder frame */}
    <rect x="8" y="17" width="40" height="43" rx="4" stroke="currentColor" strokeWidth="2"/>
    {/* Card layer */}
    <rect x="14" y="23" width="28" height="31" rx="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
  </svg>
);

const CardPopLogo = ({
  variant = 'header',
  onDark = false,
  // Monochrome lockup: render the slab icon and the "Pop" accent in the
  // wordmark colour instead of brand red. Use on solid dark/coloured panels
  // where red-on-dark would fail WCAG contrast (the style guide permits a
  // full-white or full-charcoal monochrome logo when colours can't be used).
  mono = false,
  className = '',
  iconClassName = '',
}) => {
  const cardText  = onDark ? 'text-white'              : 'text-foreground';
  const subText   = onDark ? 'text-white/50'           : 'text-muted-foreground';
  const lineColor = onDark ? 'bg-white/25'             : 'bg-border';
  // Icon + "Pop" accent — brand red by default, wordmark colour when mono.
  const accent    = mono ? cardText : 'text-primary';

  if (variant === 'icon') {
    return <CardIcon className={`${accent} ${iconClassName} ${className}`} />;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <CardIcon className={`${accent} shrink-0 ${iconClassName || 'w-7 h-[34px]'}`} />

      <span className="flex flex-col leading-none">
        {/* Wordmark */}
          <span className="font-serif font-bold tracking-wide leading-none text-[1.55rem]">
          <span className={cardText}>Card</span>
          {/* ™ is positioned absolutely so it doesn't widen the wordmark —
              otherwise the AUSTRALIA divider line stretches underneath it
              and reads as an underlined ™. font-sans keeps it out of the
              "Syne Fallback" face, whose size-adjust/ascent-override inflate
              and misplace the glyph. top-[0.22em] hangs the mark from the
              wordmark's cap line, per standard trademark lockup practice. */}
          <span className={`${accent} relative`}>Pop<sup className={`absolute left-full top-[0.22em] text-[0.65em] font-sans font-normal tracking-normal leading-none ${cardText}`}>™</sup></span>
        </span>

        {/* Australia subtitle */}
        {variant === 'full' && (
          <span className={`flex items-center gap-1.5 mt-1 text-[9px] font-bold tracking-[0.28em] uppercase ${subText}`}>
            <span className={`flex-1 h-px ${lineColor}`} />
            Australia
            <span className={`flex-1 h-px ${lineColor}`} />
          </span>
        )}
      </span>
    </span>
  );
};

export default CardPopLogo;
