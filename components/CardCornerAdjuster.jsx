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

// Loupe shown while dragging a corner: on a phone the finger hides exactly
// the pixels being aligned, so a magnified view is the difference between
// "roughly there" and actually on the card edge.
const LOUPE_SIZE = 110;   // diameter, px
const LOUPE_ZOOM = 3;     // magnification relative to the on-screen image

/**
 * Manual crop editor: shows the original image with four draggable corner
 * handles (seeded from the auto-detected quad when available, otherwise an
 * inset rectangle). Displays a split-view: left side shows adjustment handles,
 * right side shows a live preview of what the cropped result will look like
 * with the card filling the entire container.
 *
 * Mount this only while editing (conditionally render in the parent) so it
 * re-seeds cleanly each time it opens.
 */
const CardCornerAdjuster = ({ imageUrl, initialCorners, onApply, onCancel }) => {
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [natural, setNatural] = useState(null); // { w, h } natural image size
  const [displayW, setDisplayW] = useState(0);   // rendered image width (px)
  const [corners, setCorners] = useState(null);  // [[x,y]×4] in natural coords
  const [dragging, setDragging] = useState(null); // corner index | { edge: i } | null
  const [applying, setApplying] = useState(false);
  const lastPt = useRef(null); // last pointer position (natural coords) for edge drags
  const [previewUrl, setPreviewUrl] = useState(null); // live preview of cropped result

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

  // Generate live preview of the perspective-warped crop result
  useEffect(() => {
    if (!imgRef.current || !natural || !corners || !previewCanvasRef.current) return;

    const img = imgRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set preview dimensions to 5:7 card ratio (smaller for performance)
    const previewWidth = 300;
    const previewHeight = 420;
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    // Perspective transform: map the crop corners to the full preview rect
    const [tl, tr, br, bl] = corners.map(([x, y]) => [x, y]);
    const srcPoints = [tl, tr, br, bl];
    const dstPoints = [[0, 0], [previewWidth, 0], [previewWidth, previewHeight], [0, previewHeight]];

    // Use canvas 2D transforms (approximation; 3D would need WebGL)
    // Draw the image with perspective using triangle subdivisions
    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    // Subdivide the quad into triangles for better perspective accuracy
    const triangles = [
      [0, 1, 2], // top-right triangle
      [0, 2, 3], // bottom-left triangle
    ];

    try {
      ctx.save();
      for (const [i0, i1, i2] of triangles) {
        const p0 = srcPoints[i0];
        const p1 = srcPoints[i1];
        const p2 = srcPoints[i2];
        const dp0 = dstPoints[i0];
        const dp1 = dstPoints[i1];
        const dp2 = dstPoints[i2];

        // Simple bilinear sampling: map destination rect to source triangle
        ctx.beginPath();
        ctx.moveTo(dp0[0], dp0[1]);
        ctx.lineTo(dp1[0], dp1[1]);
        ctx.lineTo(dp2[0], dp2[1]);
        ctx.closePath();

        ctx.save();
        ctx.clip();

        // Draw stretched/warped version - approximate perspective
        const minX = Math.min(dp0[0], dp1[0], dp2[0]);
        const maxX = Math.max(dp0[0], dp1[0], dp2[0]);
        const minY = Math.min(dp0[1], dp1[1], dp2[1]);
        const maxY = Math.max(dp0[1], dp1[1], dp2[1]);

        // Calculate the bounding box in source space for this triangle
        const srcMinX = Math.min(p0[0], p1[0], p2[0]);
        const srcMaxX = Math.max(p0[0], p1[0], p2[0]);
        const srcMinY = Math.min(p0[1], p1[1], p2[1]);
        const srcMaxY = Math.max(p0[1], p1[1], p2[1]);

        const srcW = srcMaxX - srcMinX;
        const srcH = srcMaxY - srcMinY;
        const dstW = maxX - minX;
        const dstH = maxY - minY;

        if (srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0) {
          ctx.drawImage(
            img,
            srcMinX, srcMinY, srcW, srcH,
            minX, minY, dstW, dstH
          );
        }

        ctx.restore();
      }
    } catch {
      // Fallback: just show a darkened preview
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, previewWidth, previewHeight);
    }

    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.8));
  }, [corners, natural]);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjust crop container</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Drag handles to define the card's outer edges. The right side shows how
          the card will fill the final container — aim for a perfect rectangle.
        </p>

        {/* Live rectangle indicator */}
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

        {/* Split-view: adjustment panel (left) + live preview (right) */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4">
          {/* Left: Original image with adjustment handles */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-foreground">Adjust corners</p>
            <div className="relative inline-block flex-1 min-h-[300px] flex items-center justify-center" style={{ touchAction: 'none' }}>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Adjust crop"
                onLoad={seed}
                draggable={false}
                className="block max-w-full max-h-[40vh] select-none rounded-lg"
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
              {/* Magnifier loupe while a corner is being dragged. Anchored at
                  the same left-0/top-0 origin as the SVG overlay so it shares
                  its coordinate system; pointer-events-none so the drag keeps
                  flowing to the captured handle underneath. */}
              {ready && typeof dragging === 'number' && (() => {
                const [cx, cy] = corners[dragging];
                const dx = cx * scale;
                const dy = cy * scale;
                const zoom = LOUPE_ZOOM * scale; // background px per natural px
                const above = dy > LOUPE_SIZE + 28;
                return (
                  <div className="pointer-events-none absolute left-0 top-0 z-10">
                    <div
                      className="absolute overflow-hidden rounded-full border-2 border-white shadow-xl"
                      style={{
                        width: LOUPE_SIZE,
                        height: LOUPE_SIZE,
                        left: clamp(dx - LOUPE_SIZE / 2, 0, Math.max(0, displayW - LOUPE_SIZE)),
                        top: above ? dy - LOUPE_SIZE - 20 : dy + 20,
                        backgroundColor: '#000',
                        backgroundImage: `url(${imageUrl})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: `${natural.w * zoom}px ${natural.h * zoom}px`,
                        backgroundPosition: `${LOUPE_SIZE / 2 - cx * zoom}px ${LOUPE_SIZE / 2 - cy * zoom}px`,
                      }}
                    >
                      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: lineColor, opacity: 0.9 }} />
                      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2" style={{ background: lineColor, opacity: 0.9 }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right: Live preview of cropped result filling the container */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-foreground">Container preview</p>
            <div className="flex-1 flex items-center justify-center rounded-lg bg-black/10 min-h-[300px]">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Crop preview"
                  className="h-full max-h-[40vh] object-contain rounded-md"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Preview loading…</p>
              )}
            </div>
            <canvas
              ref={previewCanvasRef}
              className="hidden"
            />
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
