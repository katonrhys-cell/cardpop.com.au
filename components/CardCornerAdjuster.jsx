import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { defaultCorners } from '@/utils/cardCrop.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

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

  const polygon = ready ? corners.map(([x, y]) => `${x * scale},${y * scale}`).join(' ') : '';

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !applying) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust crop corners</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Drag each handle to a corner of the card, then apply.
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
                  fill="hsl(var(--primary) / 0.12)"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />
                {corners.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x * scale}
                    cy={y * scale}
                    r={11}
                    fill="hsl(var(--primary))"
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
