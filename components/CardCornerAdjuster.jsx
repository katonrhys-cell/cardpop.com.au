import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, RotateCcw, Scan } from 'lucide-react';
import { defaultCorners, orderCorners } from '@/utils/cardCrop.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Smallest crop box side, as a fraction of the image's shorter side, so a
// stray drag can't collapse the box to nothing.
const MIN_FRAC = 0.08;

// Bounding box of a quad, in natural image coordinates.
export function boundsOf(corners, w, h) {
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return {
    x0: clamp(Math.min(...xs), 0, w),
    y0: clamp(Math.min(...ys), 0, h),
    x1: clamp(Math.max(...xs), 0, w),
    y1: clamp(Math.max(...ys), 0, h),
  };
}

const rectToCorners = ({ x0, y0, x1, y1 }) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/**
 * Move one part of the crop box by (dx, dy) natural pixels. `part` is a
 * combination of edges — 'n', 's', 'e', 'w', 'ne', … — or 'move' for the
 * whole box. Edges stop at the image border and at the minimum size.
 */
export function dragRect(rect, part, dx, dy, w, h) {
  const min = Math.min(w, h) * MIN_FRAC;
  if (part === 'move') {
    const bw = rect.x1 - rect.x0;
    const bh = rect.y1 - rect.y0;
    const x0 = clamp(rect.x0 + dx, 0, w - bw);
    const y0 = clamp(rect.y0 + dy, 0, h - bh);
    return { x0, y0, x1: x0 + bw, y1: y0 + bh };
  }
  const next = { ...rect };
  if (part.includes('w')) next.x0 = clamp(rect.x0 + dx, 0, rect.x1 - min);
  if (part.includes('e')) next.x1 = clamp(rect.x1 + dx, rect.x0 + min, w);
  if (part.includes('n')) next.y0 = clamp(rect.y0 + dy, 0, rect.y1 - min);
  if (part.includes('s')) next.y1 = clamp(rect.y1 + dy, rect.y0 + min, h);
  return next;
}

const HANDLES = [
  { part: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { part: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { part: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { part: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { part: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { part: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { part: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { part: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
];

/**
 * Manual crop editor for a card photo.
 *
 * Default is a plain crop box: drag an edge or corner to trim, drag inside
 * to move, and everything outside the box is dimmed so what you see is what
 * you keep. For a card shot at an angle, "Straighten a tilted card" switches
 * to four free corners that the crop is perspective-corrected from.
 *
 * `onApply(corners)` receives four [x, y] points in natural image
 * coordinates either way — a straight box is just a rectangle quad.
 *
 * Mount only while editing (conditionally render in the parent) so it
 * re-seeds cleanly each time it opens.
 */
const CardCornerAdjuster = ({ imageUrl, initialCorners, onApply, onCancel }) => {
  const imgRef = useRef(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [display, setDisplay] = useState(null); // { w, h } rendered size
  const [mode, setMode] = useState('box');      // 'box' | 'tilt'
  const [rect, setRect] = useState(null);       // box mode, natural coords
  const [corners, setCorners] = useState(null); // tilt mode, natural coords
  const [applying, setApplying] = useState(false);
  const drag = useRef(null); // { part | corner, last: [x, y] }
  const [dragging, setDragging] = useState(false);

  const startCorners = useCallback((w, h) => (
    initialCorners && initialCorners.length === 4
      ? initialCorners.map(([x, y]) => [x, y])
      : defaultCorners(w, h, 0.04)
  ), [initialCorners]);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    // Layout size, not getBoundingClientRect(): the dialog opens with a zoom
    // animation, and a transformed measurement left the box short of the photo.
    if (img.offsetWidth && img.offsetHeight) setDisplay({ w: img.offsetWidth, h: img.offsetHeight });
  }, []);

  const seed = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    const start = startCorners(w, h);
    setCorners(start);
    setRect(boundsOf(start, w, h));
    measure();
  }, [startCorners, measure]);

  // A cached image can be complete before onLoad attaches — seed immediately.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth) seed();
  }, [seed]);

  // Keep the overlay exactly on top of the image as the dialog lays out or
  // the viewport changes. The overlay is sized from the <img> itself, so the
  // two can't drift apart.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    return () => ro.disconnect();
  }, [measure]);

  const ready = !!(natural && display && rect && corners);
  const scale = ready ? display.w / natural.w : 1;

  const toNatural = (e) => {
    // On-screen rect → natural pixels; dividing by the live rect keeps this
    // right even while a transform is still settling.
    const r = imgRef.current.getBoundingClientRect();
    return [(e.clientX - r.left) * (natural.w / r.width), (e.clientY - r.top) * (natural.h / r.height)];
  };

  const begin = (target) => (e) => {
    if (!ready || applying) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { ...target, last: toNatural(e) };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || !ready) return;
    e.preventDefault();
    const [x, y] = toNatural(e);
    const dx = x - d.last[0];
    const dy = y - d.last[1];
    d.last = [x, y];
    if (d.part) {
      setRect(prev => dragRect(prev, d.part, dx, dy, natural.w, natural.h));
    } else if (d.corner != null) {
      setCorners(prev => prev.map((c, i) => (
        i === d.corner ? [clamp(x, 0, natural.w), clamp(y, 0, natural.h)] : c
      )));
    }
  };

  const end = () => { drag.current = null; setDragging(false); };

  const switchMode = (next) => {
    if (!ready || next === mode) return;
    if (next === 'tilt') setCorners(rectToCorners(rect));
    else setRect(boundsOf(corners, natural.w, natural.h));
    setMode(next);
  };

  const reset = () => {
    if (!natural) return;
    const start = startCorners(natural.w, natural.h);
    setCorners(start);
    setRect(boundsOf(start, natural.w, natural.h));
  };

  const apply = async () => {
    if (!ready) return;
    setApplying(true);
    try {
      await onApply(mode === 'box' ? rectToCorners(rect) : orderCorners(corners));
    } finally {
      setApplying(false);
    }
  };

  // Outline of the kept area, in display pixels.
  const keep = ready
    ? (mode === 'box' ? rectToCorners(rect) : orderCorners(corners)).map(([x, y]) => [x * scale, y * scale])
    : [];
  const keepPath = keep.length ? `M${keep.map(p => p.join(',')).join('L')}Z` : '';

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !applying) onCancel(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Crop photo</DialogTitle>
          <DialogDescription>
            {mode === 'box'
              ? 'Drag the edges or corners to cut away what you don’t want. Drag inside the box to move it.'
              : 'Drag each dot onto a corner of the card. The crop is straightened for you.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center rounded-lg bg-black/80 p-3">
          {/* The overlay is positioned against this wrapper, which hugs the
              <img> exactly — no centring box between them to throw it off. */}
          <div className="relative inline-block leading-none" style={{ touchAction: 'none' }}>
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Photo to crop"
              onLoad={seed}
              draggable={false}
              className="block max-w-full max-h-[60vh] select-none"
            />
            {ready && (
              <svg
                className="absolute inset-0 overflow-visible"
                width={display.w}
                height={display.h}
                viewBox={`0 0 ${display.w} ${display.h}`}
                onPointerMove={onPointerMove}
                onPointerUp={end}
                onPointerCancel={end}
              >
                {/* Dim everything outside the kept area. */}
                <path
                  d={`M0,0H${display.w}V${display.h}H0Z ${keepPath}`}
                  fillRule="evenodd"
                  fill="rgba(0,0,0,0.6)"
                  pointerEvents="none"
                />

                {mode === 'box' ? (
                  <>
                    <rect
                      x={rect.x0 * scale}
                      y={rect.y0 * scale}
                      width={(rect.x1 - rect.x0) * scale}
                      height={(rect.y1 - rect.y0) * scale}
                      fill="transparent"
                      stroke="#fff"
                      strokeWidth="2"
                      style={{ cursor: dragging ? 'grabbing' : 'move' }}
                      onPointerDown={begin({ part: 'move' })}
                    />
                    {/* Wide invisible hit areas along each edge. */}
                    {['n', 's', 'e', 'w'].map((p) => {
                      const horiz = p === 'n' || p === 's';
                      const x = (p === 'e' ? rect.x1 : rect.x0) * scale;
                      const y = (p === 's' ? rect.y1 : rect.y0) * scale;
                      return (
                        <rect
                          key={`edge-${p}`}
                          x={horiz ? rect.x0 * scale : x - 12}
                          y={horiz ? y - 12 : rect.y0 * scale}
                          width={horiz ? (rect.x1 - rect.x0) * scale : 24}
                          height={horiz ? 24 : (rect.y1 - rect.y0) * scale}
                          fill="transparent"
                          style={{ cursor: horiz ? 'ns-resize' : 'ew-resize' }}
                          onPointerDown={begin({ part: p })}
                        />
                      );
                    })}
                    {HANDLES.map(({ part, fx, fy, cursor }) => {
                      const cx = (rect.x0 + (rect.x1 - rect.x0) * fx) * scale;
                      const cy = (rect.y0 + (rect.y1 - rect.y0) * fy) * scale;
                      const corner = part.length === 2;
                      return (
                        <g key={part} style={{ cursor }} onPointerDown={begin({ part })}>
                          <circle cx={cx} cy={cy} r={20} fill="transparent" />
                          {corner ? (
                            <circle cx={cx} cy={cy} r={9} fill="#fff" stroke="#CE1126" strokeWidth="3" />
                          ) : (
                            <rect
                              x={cx - (fy === 0.5 ? 4 : 12)}
                              y={cy - (fy === 0.5 ? 12 : 4)}
                              width={fy === 0.5 ? 8 : 24}
                              height={fy === 0.5 ? 24 : 8}
                              rx="4"
                              fill="#fff"
                              stroke="#CE1126"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <path d={keepPath} fill="transparent" stroke="#fff" strokeWidth="2" pointerEvents="none" />
                    {corners.map(([x, y], i) => (
                      <g key={i} style={{ cursor: 'grab' }} onPointerDown={begin({ corner: i })}>
                        <circle cx={x * scale} cy={y * scale} r={20} fill="transparent" />
                        <circle cx={x * scale} cy={y * scale} r={9} fill="#fff" stroke="#CE1126" strokeWidth="3" />
                      </g>
                    ))}
                  </>
                )}
              </svg>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => switchMode(mode === 'box' ? 'tilt' : 'box')}
            disabled={!ready || applying}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <Scan className="w-3.5 h-3.5" />
            {mode === 'box' ? 'Card is tilted? Straighten it' : 'Back to simple crop'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={!ready || applying}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={applying} className="flex-1">
            Cancel
          </Button>
          <Button type="button" onClick={apply} disabled={!ready || applying} className="flex-1 gap-1.5">
            {applying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Cropping…</>
              : <><Check className="w-4 h-4" /> Crop</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CardCornerAdjuster;
