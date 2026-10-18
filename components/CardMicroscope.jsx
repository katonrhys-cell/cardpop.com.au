import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Search, Plus, Minus, Maximize } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

const MIN_ZOOM = 2;
const MAX_ZOOM = 8;
const DEFAULT_ZOOM = 3;
const ZOOM_STEP = 0.5;

// Whole-image size: 1 = fit to screen, up to 4× that.
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// Lens diameter: bigger on desktop, smaller on phones so it doesn't swallow the card.
const lensSizeFor = () =>
  typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 200;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Magnifier-style card inspector. The whole card is shown fit-to-screen and a
 * round lens follows the cursor (hover) or finger (touch-drag), showing that
 * spot magnified. No panning or preset zones needed — just move over the area
 * you want to look at.
 *
 * Two independent controls:
 *  - Lens (+ / -): how strongly the spot under the lens is magnified.
 *  - Image ([ / ], 0 to fit, Ctrl+wheel, pinch on touch): how large the whole
 *    card is drawn. Past fit-to-screen the viewport scrolls, so the card can be
 *    panned with the wheel / trackpad, the scrollbars, or a two-finger drag.
 */
const CardMicroscope = ({ isOpen, onClose, imageUrl, altText }) => {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [scale, setScale] = useState(MIN_SCALE);
  const [lens, setLens] = useState(null); // { x, y, w, h, touch } — x/y relative to the image
  const [lensSize, setLensSize] = useState(lensSizeFor);
  const [fit, setFit] = useState(null); // { w, h } — the image's fit-to-screen size
  const imageRef = useRef(null);
  const viewportRef = useRef(null);
  const prevScaleRef = useRef(MIN_SCALE);
  const focalRef = useRef(null); // viewport-relative point to keep still across a scale change
  const pointersRef = useRef(new Map()); // active touch pointers → { x, y }
  const pinchRef = useRef(null); // { dist, scale, mid } while two fingers are down

  useEffect(() => {
    if (isOpen) {
      setZoom(DEFAULT_ZOOM);
      setScale(MIN_SCALE);
      prevScaleRef.current = MIN_SCALE;
      setLens(null);
      setLensSize(lensSizeFor());
      pointersRef.current.clear();
      pinchRef.current = null;
    }
  }, [isOpen]);

  // Fit-to-screen size from the natural dimensions and the viewport, so the
  // scaled size is an explicit width/height (which is what lets the viewport scroll).
  const measureFit = useCallback(() => {
    const img = imageRef.current;
    const vp = viewportRef.current;
    if (!img || !vp || !img.naturalWidth || !img.naturalHeight) return;
    const maxW = Math.min(vp.clientWidth, window.innerWidth * 0.92);
    const maxH = Math.min(vp.clientHeight, window.innerHeight * 0.72);
    if (maxW <= 0 || maxH <= 0) return;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    setFit({ w: Math.round(img.naturalWidth * ratio), h: Math.round(img.naturalHeight * ratio) });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFit(null);
    measureFit();
    window.addEventListener('resize', measureFit);
    return () => window.removeEventListener('resize', measureFit);
  }, [isOpen, imageUrl, measureFit]);

  // Change the whole-image size keeping `focal` (viewport-relative px; default
  // the viewport centre) over the same part of the card.
  const applyScale = useCallback((next, focal = null) => {
    setScale((s) => {
      const clamped = clampScale(Math.round(next(s) * 100) / 100);
      if (clamped !== s) focalRef.current = focal;
      return clamped;
    });
  }, []);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const prev = prevScaleRef.current;
    prevScaleRef.current = scale;
    if (!vp || prev === scale) return;
    const ratio = scale / prev;
    const focal = focalRef.current || { x: vp.clientWidth / 2, y: vp.clientHeight / 2 };
    focalRef.current = null;
    vp.scrollLeft = (vp.scrollLeft + focal.x) * ratio - focal.x;
    vp.scrollTop = (vp.scrollTop + focal.y) * ratio - focal.y;
  }, [scale]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') setZoom((z) => clampZoom(z + ZOOM_STEP));
      if (e.key === '-') setZoom((z) => clampZoom(z - ZOOM_STEP));
      if (e.key === ']') applyScale((s) => s + SCALE_STEP);
      if (e.key === '[') applyScale((s) => s - SCALE_STEP);
      if (e.key === '0') applyScale(() => MIN_SCALE);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, applyScale]);

  // Ctrl/⌘ + wheel resizes the whole image around the cursor instead of zooming
  // the page; a plain wheel scrolls (pans) the viewport natively.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!isOpen || !vp) return;
    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      applyScale((s) => s * (e.deltaY < 0 ? 1.1 : 1 / 1.1), focal);
    };
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [isOpen, applyScale]);

  const updateLens = useCallback((e) => {
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (!inside && e.pointerType !== 'touch') {
      setLens(null);
      return;
    }
    setLens({
      x: Math.max(0, Math.min(rect.width, x)),
      y: Math.max(0, Math.min(rect.height, y)),
      w: rect.width,
      h: rect.height,
      touch: e.pointerType === 'touch',
    });
  }, []);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'touch') {
      // Keep receiving moves while the finger slides off the image.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // The pointer may already be gone; the pinch/lens bookkeeping below still runs.
      }
      const pointers = pointersRef.current;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        // Second finger: pinch resizes the whole image, two-finger drag pans it.
        const [a, b] = [...pointers.values()];
        pinchRef.current = { dist: distance(a, b), scale, mid: midpoint(a, b) };
        setLens(null);
        return;
      }
      if (pointers.size > 2 || pinchRef.current) return;
    }
    updateLens(e);
  };

  const handlePointerMove = (e) => {
    if (e.pointerType === 'touch') {
      const pointers = pointersRef.current;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (pinch) {
        if (pointers.size !== 2) return;
        const [a, b] = [...pointers.values()];
        const vp = viewportRef.current;
        const mid = midpoint(a, b);
        if (vp) {
          // Pan by the midpoint's travel, then resize around where the fingers are.
          vp.scrollLeft -= mid.x - pinch.mid.x;
          vp.scrollTop -= mid.y - pinch.mid.y;
          const rect = vp.getBoundingClientRect();
          applyScale(() => pinch.scale * (distance(a, b) / pinch.dist), {
            x: mid.x - rect.left,
            y: mid.y - rect.top,
          });
        }
        pinch.mid = mid;
        return;
      }
    }
    updateLens(e);
  };

  const handlePointerEnd = (e) => {
    if (e.pointerType !== 'touch') return;
    const pointers = pointersRef.current;
    pointers.delete(e.pointerId);
    if (pinchRef.current && pointers.size < 2) {
      // Stay out of lens mode until every finger has lifted, so the one left
      // behind after a pinch doesn't yank the lens across the card.
      if (pointers.size === 0) pinchRef.current = null;
      else pinchRef.current = { ...pinchRef.current, dist: Infinity };
      setLens(null);
    }
  };

  const handlePointerLeave = (e) => {
    if (e.pointerType !== 'touch') setLens(null);
  };

  // Fingers cover the area being inspected, so on touch the lens floats above them.
  const lensStyle = () => {
    if (!lens) return null;
    const r = lensSize / 2;
    const imgRect = imageRef.current?.getBoundingClientRect();
    if (!imgRect) return null;
    const lift = lens.touch ? r + 32 : 0;
    const cx = imgRect.left + lens.x;
    const cy = imgRect.top + lens.y - lift;
    return {
      width: lensSize,
      height: lensSize,
      left: cx - r,
      top: cy - r,
      backgroundImage: `url("${imageUrl}")`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${lens.w * zoom}px ${lens.h * zoom}px`,
      backgroundPosition: `${r - lens.x * zoom}px ${r - lens.y * zoom}px`,
    };
  };

  if (typeof document === 'undefined') return null;

  const style = lensStyle();
  const scalePct = Math.round(scale * 100);
  const imageSizeStyle = fit
    ? { width: fit.w * scale, height: fit.h * scale, maxWidth: 'none', maxHeight: 'none' }
    : undefined;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
        >
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="text-white/80 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm tabular-nums">
              Lens {zoom.toFixed(1).replace(/\.0$/, '')}x
              <span className="text-white/40 mx-2">·</span>
              Image {scalePct}%
            </div>
            <button
              onClick={onClose}
              className="pointer-events-auto p-2 text-white/70 hover:text-white bg-black/40 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm"
              aria-label="Close magnifier"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable viewport: past fit-to-screen the card can be panned */}
          <div
            ref={viewportRef}
            className="absolute inset-x-0 top-16 bottom-32 sm:bottom-36 overflow-auto overscroll-contain"
            data-testid="microscope-viewport"
          >
            {/* min-w/min-h full + w-max keeps the card centred when it fits and
                reachable edge-to-edge when it overflows (flex centring alone clips). */}
            <div className="flex items-center justify-center min-w-full min-h-full w-max p-2">
              <img
                ref={imageRef}
                src={imageUrl}
                alt={altText}
                draggable={false}
                className="max-w-[92vw] max-h-[72vh] object-contain select-none drop-shadow-2xl cursor-none"
                style={{ touchAction: 'none', ...imageSizeStyle }}
                onLoad={measureFit}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerLeave}
              />
            </div>
          </div>

          {style && (
            <div
              className="fixed z-30 rounded-full pointer-events-none border-4 border-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.6)] bg-black"
              style={style}
              aria-hidden="true"
            >
              {/* crosshair dot marking the exact spot */}
              <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 ring-1 ring-black/40" />
            </div>
          )}

          {!lens && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-white/80 text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm pointer-events-none">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Move your cursor over the card to magnify</span>
              <span className="sm:hidden">Touch and drag over the card to magnify</span>
            </div>
          )}

          {/* Controls: lens strength + whole-image size */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 w-[92vw] max-w-md">
            <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              {/* Lens strength */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="w-12 shrink-0 text-xs font-medium text-white/60 uppercase tracking-wide">Lens</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
                  disabled={zoom <= MIN_ZOOM}
                  className="text-white hover:bg-white/20 rounded-lg h-10 w-10 shrink-0"
                  title="Less magnification (- key)"
                  aria-label="Less magnification"
                >
                  <ZoomOut className="w-5 h-5" />
                </Button>

                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={ZOOM_STEP}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 min-w-0 accent-primary"
                  aria-label="Magnification"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
                  disabled={zoom >= MAX_ZOOM}
                  className="text-white hover:bg-white/20 rounded-lg h-10 w-10 shrink-0"
                  title="More magnification (+ key)"
                  aria-label="More magnification"
                >
                  <ZoomIn className="w-5 h-5" />
                </Button>
                {/* Spacer so both sliders line up; the Image row has a Fit button here */}
                <span className="w-10 shrink-0" aria-hidden="true" />
              </div>

              {/* Whole-image size */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="w-12 shrink-0 text-xs font-medium text-white/60 uppercase tracking-wide">Image</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => applyScale((s) => s - SCALE_STEP)}
                  disabled={scale <= MIN_SCALE}
                  className="text-white hover:bg-white/20 rounded-lg h-10 w-10 shrink-0"
                  title="Shrink the whole image ([ key)"
                  aria-label="Shrink image"
                >
                  <Minus className="w-5 h-5" />
                </Button>

                <input
                  type="range"
                  min={MIN_SCALE}
                  max={MAX_SCALE}
                  step={SCALE_STEP}
                  value={scale}
                  onChange={(e) => applyScale(() => parseFloat(e.target.value))}
                  className="flex-1 min-w-0 accent-primary"
                  aria-label="Image size"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => applyScale((s) => s + SCALE_STEP)}
                  disabled={scale >= MAX_SCALE}
                  className="text-white hover:bg-white/20 rounded-lg h-10 w-10 shrink-0"
                  title="Enlarge the whole image (] key)"
                  aria-label="Enlarge image"
                >
                  <Plus className="w-5 h-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => applyScale(() => MIN_SCALE)}
                  disabled={scale <= MIN_SCALE}
                  className="text-white hover:bg-white/20 rounded-lg h-10 w-10 shrink-0"
                  title="Fit the whole card on screen (0 key)"
                  aria-label="Fit image to screen"
                >
                  <Maximize className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <p className="text-white/40 text-xs text-center mt-2 hidden sm:block">
              +/- lens · [ ] image size · 0 fit · Ctrl+scroll to resize · Esc to close
            </p>
            <p className="text-white/40 text-xs text-center mt-2 sm:hidden">
              Pinch to resize the card · two fingers to pan
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CardMicroscope;
