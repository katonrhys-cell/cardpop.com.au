import React, { useState, useRef, useCallback, useEffect } from 'react';
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
 * inset rectangle). On apply it hands the adjusted corners — in natural image
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

  const onPointerMove = (e) => {
    if (dragging == null || !natural) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / scale, 0, natural.w);
    const y = clamp((e.clientY - rect.top) / scale, 0, natural.h);
    setCorners(prev => prev.map((c, i) => (i === dragging ? [x, y] : c)));
  };

  const endDrag = () => setDragging(null);

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
            {ready && (
              <svg
                className="absolute left-0 top-0 overflow-visible"
                width={displayW}
                height={displayH}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
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
                    onPointerDown={(e) => { e.preventDefault(); setDragging(i); }}
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
