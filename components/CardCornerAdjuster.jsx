import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Square, CheckCircle2, AlertTriangle } from 'lucide-react';
import { defaultCorners, orderCorners, CARD_RATIO } from '@/utils/cardCrop.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Interior angle (degrees) at point b, formed by segments b→a and b→c.
const angleAt = (a, b, c) => {
  const v1 = [a[0] - b[0], a[1] - b[1]];
  const v2 = [c[0] - b[0], c[1] - b[1]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const m1 = Math.hypot(v1[0], v1[1]);
  const m2 = Math.hypot(v2[0], v2[1]);
  if (!m1 || !m2) return 0;
  return Math.acos(clamp(dot / (m1 * m2), -1, 1)) * (180 / Math.PI);
};

// How square the quad is: the largest deviation of any corner from a right angle.
// A perfect rectangle scores 0. We treat <= ANGLE_TOLERANCE as "perfect".
const ANGLE_TOLERANCE = 4; // degrees

function evaluateQuad(corners) {
  const [tl, tr, br, bl] = orderCorners(corners);
  const ring = [tl, tr, br, bl];
  let maxDev = 0;
  for (let i = 0; i < 4; i++) {
    const a = ring[(i + 3) % 4];
    const b = ring[i];
    const c = ring[(i + 1) % 4];
    maxDev = Math.max(maxDev, Math.abs(angleAt(a, b, c) - 90));
  }
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const width = (dist(tl, tr) + dist(bl, br)) / 2;
  const height = (dist(tl, bl) + dist(tr, br)) / 2;
  const ratio = width && height ? Math.min(width, height) / Math.max(width, height) : 0;
  return { maxDev, isRectangle: maxDev <= ANGLE_TOLERANCE, ratio, ordered: ring };
}

/**
 * Manual crop editor: shows the original image with four draggable corner
 * handles (seeded from the auto-detected quad when available, otherwise an
 * inset rectangle). It overlays a perspective-aware rule-of-thirds grid, edge
 * handles, and a live "perfect rectangle" indicator so the user can tell at a
 * glance whether their crop is square — plus a one-tap snap-to-rectangle. On
 * apply it hands the adjusted corners — in natural image coordinates — back to
 * the parent, which warps the image.
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

  const startCornerDrag = (i) => (e) => { e.preventDefault(); setDragging(i); };
  const startEdgeDrag = (i) => (e) => {
    e.preventDefault();
    lastPt.current = pointerToImage(e);
    setDragging({ edge: i });
  };
  const endDrag = () => { setDragging(null); lastPt.current = null; };

  // Replace the current quad with the smallest upright rectangle that contains
  // it — guarantees four perfect right angles while staying close to the user's
  // framing.
  const snapToRectangle = () => {
    if (!corners) return;
    const xs = corners.map(c => c[0]);
    const ys = corners.map(c => c[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    setCorners([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
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

  const evalResult = useMemo(() => (ready ? evaluateQuad(corners) : null), [ready, corners]);

  // Perspective-aware overlay geometry, all in display pixels.
  const overlay = useMemo(() => {
    if (!ready) return null;
    const [tl, tr, br, bl] = evalResult.ordered;
    const px = ([x, y]) => `${x * scale},${y * scale}`;
    const polygon = [tl, tr, br, bl].map(px).join(' ');
    // Rule-of-thirds lines that follow the (possibly skewed) quad via bilinear
    // interpolation, so the grid stays glued to the crop as corners move.
    const at = (u, v) => {
      const top = lerp(tl, tr, u);
      const bottom = lerp(bl, br, u);
      return lerp(top, bottom, v);
    };
    const lines = [];
    for (const u of [1 / 3, 2 / 3]) lines.push([at(u, 0), at(u, 1)]);
    for (const v of [1 / 3, 2 / 3]) lines.push([at(0, v), at(1, v)]);
    // Edge handles at the midpoint of each side (array-order ring).
    const edges = corners.map((c, i) => {
      const n = corners[(i + 1) % 4];
      return [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2];
    });
    return { polygon, lines, edges };
  }, [ready, evalResult, corners, scale]);

  const ok = evalResult?.isRectangle;
  const strokeColor = ok ? 'hsl(142 71% 45%)' : 'hsl(var(--primary))';
  const fillColor = ok ? 'hsl(142 71% 45% / 0.12)' : 'hsl(var(--primary) / 0.12)';

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !applying) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust crop corners</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Drag each corner to a corner of the card, or drag a side to nudge a whole
          edge. Keep the outline square for a clean rectangle.
        </p>

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
                onPointerLeave={endDrag}
              >
                <polygon
                  points={overlay.polygon}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="2"
                />
                {/* Rule-of-thirds guide grid */}
                {overlay.lines.map(([p1, p2], i) => (
                  <line
                    key={`g${i}`}
                    x1={p1[0] * scale} y1={p1[1] * scale}
                    x2={p2[0] * scale} y2={p2[1] * scale}
                    stroke={strokeColor}
                    strokeWidth="1"
                    strokeOpacity="0.4"
                  />
                ))}
                {/* Edge (side) handles */}
                {overlay.edges.map(([x, y], i) => (
                  <rect
                    key={`e${i}`}
                    x={x * scale - 7} y={y * scale - 7}
                    width="14" height="14" rx="3"
                    fill="#fff"
                    stroke={strokeColor}
                    strokeWidth="2"
                    style={{ cursor: 'move' }}
                    onPointerDown={startEdgeDrag(i)}
                  />
                ))}
                {/* Corner handles */}
                {corners.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x * scale}
                    cy={y * scale}
                    r={11}
                    fill={strokeColor}
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

        {/* Live "perfect rectangle" indicator */}
        {ready && evalResult && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
              ok
                ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
          >
            {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">
              {ok
                ? 'Perfect rectangle — corners are square.'
                : `Edges are skewed by ${Math.round(evalResult.maxDev)}°. Square the corners or snap to a rectangle.`}
            </span>
            {!ok && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={snapToRectangle}
                className="h-7 gap-1.5 px-2"
              >
                <Square className="w-3.5 h-3.5" /> Snap
              </Button>
            )}
          </div>
        )}

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
