import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, CheckCircle2, Frame, Square } from 'lucide-react';
import {
  defaultCorners, orderCorners, isRectangularQuad, rectifyQuad,
} from '@/utils/cardCrop.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Colours for the crop overlay: emerald once the selection is a true
// rectangle, the brand primary while it still needs straightening.
const OK_COLOR = '#10b981';

/**
 * Manual crop editor: shows the original image with four draggable corner
 * handles (seeded from the auto-detected quad when available, otherwise an
 * inset rectangle). It overlays a perspective-aware rule-of-thirds grid, edge
 * handles, and a live "perfect rectangle" indicator so the user can tell at a
 * glance whether their crop is square — plus a one-tap snap to a clean 5:7 card
 * rectangle. On apply it hands the adjusted corners — in natural image
 * coordinates — back to the parent, which warps the image.
 *
 * Mount this only while editing (conditionally render in the parent) so it
 * re-seeds cleanly each time it opens.
 */
const CardCornerAdjuster = ({ imageUrl, initialCorners, onApply, onCancel }) => {
  const imgRef = useRef(null);
  const [natural, setNatural] = useState(null); // { w, h } natural image size
  const [displayW, setDisplayW] = useState(0);   // rendered image width (px)
  const [corners, setCorners] = useState(null);  // [[x,y]×4] in natural coords
  const [dragging, setDragging] = useState(null); // corner index | { edge: i } | null
  const [applying, setApplying] = useState(false);
  const lastPt = useRef(null); // last pointer position (natural coords) for edge drags

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

  const pointerToImage = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    return [
      clamp((e.clientX - rect.left) / scale, 0, natural.w),
      clamp((e.clientY - rect.top) / scale, 0, natural.h),
    ];
  };

  const onPointerMove = (e) => {
    if (dragging == null || !natural) return;
    e.preventDefault();
    const [x, y] = pointerToImage(e);

    if (typeof dragging === 'number') {
      setCorners(prev => prev.map((c, i) => (i === dragging ? [x, y] : c)));
      return;
    }
    // Edge drag: translate both endpoints of the edge by the pointer delta so
    // the whole side moves together — handy for straightening one edge.
    if (dragging.edge != null && lastPt.current) {
      const dx = x - lastPt.current[0];
      const dy = y - lastPt.current[1];
      const i = dragging.edge;
      const j = (i + 1) % 4;
      setCorners(prev => prev.map((c, k) => (
        k === i || k === j
          ? [clamp(c[0] + dx, 0, natural.w), clamp(c[1] + dy, 0, natural.h)]
          : c
      )));
      lastPt.current = [x, y];
    }
  };

  // Pointer capture keeps move/up events flowing to the handle even when the
  // finger/cursor strays outside the SVG, so a drag toward the image edge no
  // longer silently drops.
  const capture = (e) => e.currentTarget.setPointerCapture?.(e.pointerId);
  const startCornerDrag = (i) => (e) => { e.preventDefault(); capture(e); setDragging(i); };
  const startEdgeDrag = (i) => (e) => {
    e.preventDefault();
    capture(e);
    lastPt.current = pointerToImage(e);
    setDragging({ edge: i });
  };
  const endDrag = () => { setDragging(null); lastPt.current = null; };

  // Snap to a clean, upright 5:7 card rectangle centred on the current framing —
  // guarantees four right angles at the standard card ratio.
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

  // Snap the current selection to an upright rectangle (clamped to the image)
  // so the user gets a perfect rectangle crop in one tap.
  const snapToRectangle = () => {
    if (!corners || !natural) return;
    setCorners(
      rectifyQuad(corners).map(([x, y]) => [clamp(x, 0, natural.w), clamp(y, 0, natural.h)]),
    );
  };

  const polygon = ready ? corners.map(([x, y]) => `${x * scale},${y * scale}`).join(' ') : '';

  // Is the selection square enough to crop without perspective distortion?
  const isRect = ready ? isRectangularQuad(corners) : false;
  const lineColor = isRect ? OK_COLOR : 'hsl(var(--primary))';

  // Perspective-correct rule-of-thirds guide lines, drawn between the
  // interpolated thirds of opposite edges of the (ordered) selection. They give
  // the user a reference for keeping the card square as they drag the corners.
  const gridLines = [];
  if (ready) {
    const [tl, tr, br, bl] = orderCorners(corners).map(([x, y]) => [x * scale, y * scale]);
    for (const t of [1 / 3, 2 / 3]) {
      gridLines.push([lerp(tl, tr, t), lerp(bl, br, t)]); // vertical thirds
      gridLines.push([lerp(tl, bl, t), lerp(tr, br, t)]); // horizontal thirds
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !applying) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust crop corners</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Drag each handle to a corner of the card. Keep the edges square — the
          guides below turn green when your crop is a perfect rectangle.
        </p>

        {/* Live rectangle indicator: green confirmation when square, amber
            nudge while the selection is still skewed. */}
        <div
          role="status"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
            isRect
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
          }`}
        >
          {isRect ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Perfect rectangle — ready to crop</>
          ) : (
            <><Frame className="w-3.5 h-3.5" /> Line the handles up with the card edges to square the crop</>
          )}
        </div>

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
            {ready && overlay && (
              <svg
                className="absolute left-0 top-0 overflow-visible"
                width={displayW}
                height={displayH}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
              >
                <polygon
                  points={polygon}
                  fill={isRect ? `${OK_COLOR}1f` : 'hsl(var(--primary) / 0.12)'}
                  stroke={lineColor}
                  strokeWidth="2"
                />
                {gridLines.map(([[x1, y1], [x2, y2]], i) => (
                  <line
                    key={`g${i}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={lineColor}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    strokeOpacity="0.55"
                  />
                ))}
                {corners.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x * scale}
                    cy={y * scale}
                    r={11}
                    fill={lineColor}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onPointerDown={startCornerDrag(i)}
                  />
                ))}
              </svg>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={snapToRectangle}
          disabled={!ready || applying}
          className="gap-1.5 self-center text-xs text-muted-foreground"
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
