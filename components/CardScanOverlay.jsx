import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';

/**
 * The full-screen visual that plays while a card is being identified.
 *
 * Card identification is the slowest thing a seller waits on — two model calls
 * plus a price lookup, several seconds end to end — and it used to be a 12px
 * spinner next to the words "Analyzing card…". This is that same wait, told as
 * a scan: the seller's own photo held under a beam that sweeps it top to
 * bottom, the phase named in brand type, and a chevron chase carrying the
 * progress. It is purely presentational — every animation is CSS in
 * global.css (`.cardscan*`), so nothing is pulled onto the listing path for it.
 *
 * Props:
 *   open      — whether the overlay is showing
 *   imageUrl  — object URL / src of the photo being identified (optional; a
 *               placeholder frame is scanned instead when there isn't one)
 *   label     — what is happening right now, e.g. "Reading the card". Rendered
 *               uppercase; keep it short enough to hold one or two lines.
 *   onCancel  — optional. Renders the cancel control and binds Escape. Leave it
 *               off when the work genuinely can't be abandoned.
 */
const CardScanOverlay = ({ open, imageUrl, label = 'Identifying card', onCancel }) => {
  const dialogRef = useRef(null);
  // Kept in a ref so the Escape/cleanup effect doesn't rebind on every render
  // of a parent that passes a fresh arrow function.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onCancelRef.current) {
        e.preventDefault();
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Move focus onto the overlay so a keyboard user isn't left tabbing around
    // the form underneath while it is covered. The container takes it rather
    // than the cancel button — a programmatic focus counts as focus-visible in
    // Chromium, and the button's focus ring would then paint on every open.
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="cardscan fixed inset-0 z-[70] outline-none flex flex-col items-center justify-center overflow-hidden px-6 py-10"
      style={{ background: 'radial-gradient(120% 90% at 50% 38%, #1f2937 0%, #131a24 45%, #0a0e14 100%)' }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="card-scan-overlay"
    >
      {/* Ground: a red bloom behind the card, and two diagonal light bands. */}
      <div
        aria-hidden="true"
        className="cardscan__bloom pointer-events-none absolute left-1/2 top-[38%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(206,17,38,0.28) 0%, rgba(206,17,38,0.08) 45%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="cardscan__streaks pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(102deg, transparent 18%, rgba(196,206,212,0.05) 26%, transparent 34%),' +
            'linear-gradient(102deg, transparent 52%, rgba(196,206,212,0.04) 58%, transparent 64%)',
        }}
      />

      {/* The card under the beam. Both beam layers run the same keyframes for
          the same duration and mount together, so they stay in lockstep. */}
      <div className="relative flex w-full max-w-sm flex-1 items-center justify-center">
        <div className="cardscan__card relative">
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="block max-h-[44vh] w-auto max-w-full object-contain"
              />
            ) : (
              // No photo to show (a re-scan from saved data, say) — the frame
              // itself gets scanned so the visual still reads.
              <div className="h-[44vh] w-[31vh] max-w-full bg-white/[0.04]" />
            )}

            {/* Wash: the light the beam has just passed through. Clipped to the
                card's rounded frame so it can't bleed past the corners. */}
            <div
              aria-hidden="true"
              className="cardscan__sweep pointer-events-none absolute inset-x-0 top-0 h-full"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 62%, rgba(206,17,38,0.10) 86%, rgba(255,66,87,0.26) 97%, rgba(255,66,87,0.40) 100%)',
              }}
            />
          </div>

          {/* Line: a sibling of the clipped frame, and wider than it, so the
              beam overhangs the card edges instead of stopping at them. */}
          <div
            aria-hidden="true"
            className="cardscan__sweep pointer-events-none absolute -left-[7%] -right-[7%] top-0 h-full"
          >
            <span
              className="absolute inset-x-0 bottom-0 block h-[2px]"
              style={{
                background: 'var(--cardscan-accent)',
                boxShadow: '0 0 10px 1px rgba(255,66,87,0.95), 0 0 34px 8px rgba(206,17,38,0.55)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Phase + chevron chase. */}
      <div className="relative flex shrink-0 flex-col items-center gap-4 pb-2 text-center">
        {/* The live region wraps the heading rather than being it, so each
            phase is announced without the heading losing its role. */}
        <div role="status" aria-live="polite">
          <h2 className="font-heading text-[clamp(1.5rem,6.5vw,2.5rem)] font-extrabold uppercase leading-tight tracking-tight text-balance text-white">
            {label}
          </h2>
        </div>
        <div aria-hidden="true" className="flex items-center -space-x-2">
          {[0, 1, 2].map(i => (
            <ChevronRight key={i} className="cardscan__chevron h-10 w-10 sm:h-11 sm:w-11" strokeWidth={5} />
          ))}
        </div>
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="relative mt-8 inline-flex min-h-touch items-center gap-2 rounded-pill border-0 bg-transparent px-4 text-sm font-bold uppercase tracking-widest text-brand-silver/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-silver/60"
        >
          <X className="h-4 w-4" /> Cancel scan
        </button>
      )}
    </div>,
    document.body,
  );
};

export default CardScanOverlay;
