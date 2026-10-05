import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

const MIN_ZOOM = 2;
const MAX_ZOOM = 8;
const DEFAULT_ZOOM = 3;
const ZOOM_STEP = 0.5;

// Lens diameter: bigger on desktop, smaller on phones so it doesn't swallow the card.
const lensSizeFor = () =>
  typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 200;

/**
 * Magnifier-style card inspector. The whole card is shown fit-to-screen and a
 * round lens follows the cursor (hover) or finger (touch-drag), showing that
 * spot magnified. No panning or preset zones needed — just move over the area
 * you want to look at.
 */
const CardMicroscope = ({ isOpen, onClose, imageUrl, altText }) => {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [lens, setLens] = useState(null); // { x, y, w, h, touch } — x/y relative to the image
  const [lensSize, setLensSize] = useState(lensSizeFor);
  const imageRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(DEFAULT_ZOOM);
      setLens(null);
      setLensSize(lensSizeFor());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
      if (e.key === '-') setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

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
    // Keep receiving moves while the finger slides off the image.
    if (e.pointerType === 'touch') e.currentTarget.setPointerCapture?.(e.pointerId);
    updateLens(e);
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
            <div className="text-white/80 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
              {zoom.toFixed(1).replace(/\.0$/, '')}x
            </div>
            <button
              onClick={onClose}
              className="pointer-events-auto p-2 text-white/70 hover:text-white bg-black/40 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm"
              aria-label="Close magnifier"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image + lens */}
          <div className="w-full h-full flex items-center justify-center pb-24 pt-16">
            <img
              ref={imageRef}
              src={imageUrl}
              alt={altText}
              draggable={false}
              className="max-w-[92vw] max-h-[72vh] object-contain select-none drop-shadow-2xl cursor-none"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={updateLens}
              onPointerLeave={handlePointerLeave}
            />
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

          {/* Zoom strength */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90vw] max-w-md">
            <div className="flex items-center justify-center gap-3 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                disabled={zoom <= MIN_ZOOM}
                className="text-white hover:bg-white/20 rounded-lg h-10 w-10"
                title="Less magnification (- key)"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>

              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.5"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-40 sm:w-56 accent-primary"
                aria-label="Magnification"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                disabled={zoom >= MAX_ZOOM}
                className="text-white hover:bg-white/20 rounded-lg h-10 w-10"
                title="More magnification (+ key)"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-white/40 text-xs text-center mt-2 hidden sm:block">
              +/- to change magnification, Esc to close
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CardMicroscope;
