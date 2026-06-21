import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, Move, Eye } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

const PRESET_ZONES = {
  center: { x: 50, y: 50, zoom: 2, label: 'Center' },
  topLeft: { x: 25, y: 25, zoom: 3, label: 'Top Left' },
  topRight: { x: 75, y: 25, zoom: 3, label: 'Top Right' },
  bottomLeft: { x: 25, y: 75, zoom: 3, label: 'Bottom Left' },
  bottomRight: { x: 75, y: 75, zoom: 3, label: 'Bottom Right' },
  topEdge: { x: 50, y: 15, zoom: 2.5, label: 'Top Edge' },
  bottomEdge: { x: 50, y: 85, zoom: 2.5, label: 'Bottom Edge' },
  leftEdge: { x: 15, y: 50, zoom: 2.5, label: 'Left Edge' },
  rightEdge: { x: 85, y: 50, zoom: 2.5, label: 'Right Edge' },
};

const CardMicroscope = ({ isOpen, onClose, imageUrl, altText }) => {
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  // Reset to the full-card (fit) view each time the microscope opens.
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPanX(0);
      setPanY(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') handleZoom(0.5);
      if (e.key === '-') handleZoom(-0.5);
      if (e.key === 'r' || e.key === 'R') resetView();

      const panStep = 30;
      if (e.key === 'ArrowUp') setPanY(prev => prev + panStep);
      if (e.key === 'ArrowDown') setPanY(prev => prev - panStep);
      if (e.key === 'ArrowLeft') setPanX(prev => prev + panStep);
      if (e.key === 'ArrowRight') setPanX(prev => prev - panStep);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleZoom = (delta) => {
    setScale(prev => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    handleZoom(delta);
  };

  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const maxPan = (scale - 1) * (rect.width / 2);

    let newPanX = e.clientX - dragStart.x;
    let newPanY = e.clientY - dragStart.y;

    newPanX = Math.max(-maxPan, Math.min(maxPan, newPanX));
    newPanY = Math.max(-maxPan, Math.min(maxPan, newPanY));

    setPanX(newPanX);
    setPanY(newPanY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  };

  const focusOnZone = (zone) => {
    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 600;

    setScale(zone.zoom);
    setPanX(-((zone.x / 100) * containerWidth - containerWidth / 2));
    setPanY(-((zone.y / 100) * containerHeight - containerHeight / 2));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
            <div className="text-white/80 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
              {Math.round(scale * 100)}%
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white bg-black/40 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm"
              aria-label="Close microscope"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Viewer */}
          <div
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            style={{ cursor: scale > 1 && isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
            onMouseDown={handleMouseDown}
          >
            <motion.img
              ref={imageRef}
              src={imageUrl}
              alt={altText}
              className="max-w-[90vw] max-h-[68vh] object-contain pointer-events-none select-none drop-shadow-2xl"
              style={{
                scale,
                x: panX,
                y: panY,
              }}
              drag={scale > 1}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0}
              onDrag={(event, info) => {
                if (scale > 1) {
                  const maxPan = (scale - 1) * 200;
                  setPanX(Math.max(-maxPan, Math.min(maxPan, info.offset.x)));
                  setPanY(Math.max(-maxPan, Math.min(maxPan, info.offset.y)));
                }
              }}
            />

            {/* Minimap */}
            <div className="absolute bottom-20 right-6 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 hidden md:block">
              <div className="w-28 h-36 bg-white/5 rounded border border-white/20 relative overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Minimap"
                  className="w-full h-full object-contain opacity-40"
                />
                {scale > 1 && (
                  <div
                    className="absolute border-2 border-primary/60 bg-primary/10 rounded transition-all"
                    style={{
                      width: `${(1 / scale) * 100}%`,
                      height: `${(1 / scale) * 100}%`,
                      left: `${(50 - (panX / 200) - (1 / scale) * 50)}%`,
                      top: `${(50 - (panY / 200) - (1 / scale) * 50)}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-4 w-[90vw] max-w-2xl">
            {/* Zoom and Pan Controls */}
            <div className="flex items-center justify-center gap-3 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleZoom(-0.5)}
                disabled={scale <= MIN_SCALE}
                className="text-white hover:bg-white/20 rounded-lg h-10 w-10"
                title="Zoom Out (- key)"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>

              <input
                type="range"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-32 sm:w-48 accent-primary"
                title="Drag to zoom"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleZoom(0.5)}
                disabled={scale >= MAX_SCALE}
                className="text-white hover:bg-white/20 rounded-lg h-10 w-10"
                title="Zoom In (+ key)"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <div className="w-px h-6 bg-white/20" />

              <Button
                variant="ghost"
                size="icon"
                onClick={resetView}
                disabled={scale === MIN_SCALE && panX === 0 && panY === 0}
                className="text-white hover:bg-white/20 rounded-lg h-10 w-10"
                title="Reset View (R key)"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {/* Preset Zones */}
            <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <p className="text-white/60 text-xs font-medium mb-3 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Inspect Edges & Details
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {Object.entries(PRESET_ZONES).map(([key, zone]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    onClick={() => focusOnZone(zone)}
                    className="text-xs font-medium h-8 px-2 rounded-lg border border-white/20 !bg-white/5 !text-white hover:!bg-white/20 transition-all"
                    title={`Focus on ${zone.label}`}
                  >
                    {zone.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <p className="text-white/40 text-xs text-center">
              Use arrow keys to pan, +/- to zoom, R to reset, Esc to close
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CardMicroscope;
