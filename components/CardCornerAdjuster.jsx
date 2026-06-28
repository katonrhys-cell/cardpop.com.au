import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, CheckCircle2, AlertTriangle, Square } from 'lucide-react';
import { defaultCorners, cropGuideStatus, rectifyToCard } from '@/utils/cardCrop.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Manual crop editor: shows the original image with four draggable corner
 * handles (seeded from the auto-detected quad when available, otherwise an
 * inset rectangle). A live guide overlay tells the user how close their
 * selection is to a clean 5:7 card rectangle, and a one-tap "Snap to rectangle"
 * action straightens it for them. On apply it hands the adjusted corners — in
 * natural image coordinates — back to the parent, which warps the image.
 *
 * Mount this only while editing (conditionally render in the parent) so it
 * re-seeds cleanly each time it opens.
 */
const CardCornerAdjuster = ({ imageUrl, initialCorners, onApply, onCancel }) => {
  const imgRef = useRef(null);
  const [natural, setNatural] = useState(null); // { w, h } natural image size
  const [displayW, setDisplayW] = useState(0);   // rendered image width (px)
  const [corners, setCorners] = useState(null);  // [[x,y]×4] in natural coords
  const [dragging, setDragging] = useState(null);
  const [applying, setApplying] = useState(false);

  const seed = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    setDisplayW(img.getBoundingClientRect().width);
    setCorners(
      initialCorners && initialCorners.length === 4
        ? initialCorners.map(([x, y]) => [x, y])
        : defaultCorners(w, h),
    );
  }, [initialCorners]);

  // A cached image can be complete before onLoad attaches — seed immediately.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth) seed();
  }, [seed]);

  // Keep the overlay aligned to the image if the viewport/layout changes.
  useEffect(() => {
    const onResize = () => { if (imgRef.current) setDisplayW(imgRef.current.getBoundingClientRect().width); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scale = natural && displayW ? displayW / natural.w : 1;
  const displayH = natural ? natural.h * scale : 0;
  const ready = !!(natural && corners && displayW > 0);

  // Move the corner under the active pointer. Reads coordinates from the image
  // (not the SVG) so dragging stays accurate even past the overlay's edge.
  const moveActiveCorner = useCallback((clientX, clientY) => {
    if (dragging == null || !natural || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / scale, 0, natural.w);
    const y = clamp((clientY - rect.top) / scale, 0, natural.h);
    setCorners(prev => prev.map((c, i) => (i === dragging ? [x, y] : c)));
  }, [dragging, natural, scale]);

  const onPointerMove = (e) => {
    if (dragging == null) return;
    e.preventDefault();
    moveActiveCorner(e.clientX, e.clientY);
  };

  const startDrag = (i) => (e) => {
    e.preventDefault();
    // Pointer capture keeps move/up events flowing to this handle even when the
    // finger/cursor strays outside the SVG — the old behaviour dropped the drag.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(i);
  };

  const endDrag = () => setDragging(null);

  // Live feedback on how rectangular / card-shaped the current selection is.
  const status = useMemo(() => (corners ? cropGuideStatus(corners) : null), [corners]);

  const snapToRectangle = () => {
    if (!corners || !natural) return;
    setCorners(rectifyToCard(corners, natural.w, natural.h));
  };

  const apply = async () => {
    if (!corners) return;
    setApplying(true);
    try {
      await onApply(corners);
    } finally {
      setApplying(false);
    }
  };

  const perfect = status?.isPerfect;
  const stroke = perfect ? 'hsl(142 71% 45%)' : 'hsl(var(--primary))';
  const polygon = ready ? corners.map(([x, y]) => `${x * scale},${y * scale}`).join(' ') : '';

  // Rule-of-thirds guide lines inside the quad: interpolate along opposite
  // edges so the grid follows the selection even when it's skewed.
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const guideLines = useMemo(() => {
    if (!ready) return [];
    const [tl, tr, br, bl] = corners;
    const lines = [];
    for (const t of [1 / 3, 2 / 3]) {
      // vertical thirds (top edge → bottom edge)
      lines.push([lerp(tl, tr, t), lerp(bl, br, t)]);
      // horizontal thirds (left edge → right edge)
      lines.push([lerp(tl, bl, t), lerp(tr, br, t)]);
    }
    return lines.map(([a, b]) => [
      [a[0] * scale, a[1] * scale],
      [b[0] * scale, b[1] * scale],
    ]);
  }, [ready, corners, scale]);

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !applying) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust crop corners</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Drag each handle to a corner of the card. The guide turns green when
          you&apos;ve framed a clean card rectangle.
        </p>

        {/* Live rectangle / ratio indicator */}
        {status && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
              perfect
                ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
            role="status"
            aria-live="polite"
          >
            {perfect ? (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Perfect — straight edges at the standard card ratio.
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {!status.isRectangle && 'Straighten the edges'}
                  {!status.isRectangle && !status.matchesCard && ' · '}
                  {!status.matchesCard && 'aim for a 5:7 card shape'}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <div className="relative inline-block" style={{ touchAction: 'none' }}>
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Adjust crop"
              onLoad={seed}
              draggable={false}
              className="block max-w-full max-h-[55vh] select-none rounded-lg"
            />
            {ready && (
              <svg
                className="absolute left-0 top-0 overflow-visible"
                width={displayW}
                height={displayH}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
              >
                <polygon
                  points={polygon}
                  fill={perfect ? 'hsl(142 71% 45% / 0.12)' : 'hsl(var(--primary) / 0.12)'}
                  stroke={stroke}
                  strokeWidth="2"
                />
                {/* Rule-of-thirds composition guides */}
                {guideLines.map(([[x1, y1], [x2, y2]], i) => (
                  <line
                    key={`g${i}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={stroke}
                    strokeWidth="1"
                    strokeOpacity="0.35"
                    strokeDasharray="4 4"
                  />
                ))}
                {corners.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x * scale}
                    cy={y * scale}
                    r={11}
                    fill={stroke}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onPointerDown={startDrag(i)}
                  />
                ))}
              </svg>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={snapToRectangle}
          disabled={!ready || applying}
          className="gap-1.5"
        >
          <Square className="w-3.5 h-3.5" /> Snap to perfect rectangle
        </Button>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={applying} className="flex-1">
            Cancel
          </Button>
          <Button type="button" onClick={apply} disabled={!ready || applying} className="flex-1 gap-1.5">
            {applying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
              : <><Check className="w-4 h-4" /> Apply crop</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CardCornerAdjuster;
